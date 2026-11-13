import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_TTL_MS,
  INBOUND_REPLIES,
  PhoneVerificationError,
  confirmVerificationCode,
  consumeNumberProof,
  formatVerificationNumber,
  hashVerificationCode,
  inboundMessage,
  isOtpInstance,
  receiveVerificationMessage,
  releaseNumberProof,
  sendVerificationCode,
  senderNumberDigits,
  startInboundVerification,
  usableNumberProof,
  verificationMessage,
  verificationStatus,
  type OtpSender,
  type VerificationTarget,
} from "../lib/phone-verification";
import { hashTrialNumber } from "../lib/trial-eligibility";
import type { PrismaClient } from "../src/generated/prisma/client";
import { addMember, createUser, withTestDatabase } from "./helpers/database";

process.env.BETTER_AUTH_SECRET ??= "test-secret";
// Numéro et instance d’ExtravertyAI, auxquels les clients envoient leur code.
process.env.OTP_WHATSAPP_NUMBER = "+241 76 20 56 29";
process.env.OTP_WHATSAPP_INSTANCE = "extravertyai-otp";

/** Faux WhatsApp : garde chaque message pour relire le code reçu. */
function phone() {
  const inbox: Array<{ digits: string; text: string; code: string }> = [];
  const send: OtpSender = async (digits, text) => {
    const code = /\b(\d{6})\b/.exec(text)?.[1];
    assert.ok(code, text);
    inbox.push({ digits, text, code });
  };
  return { inbox, send, code: () => inbox.at(-1)!.code };
}

/** Code différent de celui reçu, pour simuler une erreur de saisie. */
const wrong = (code: string) => (code === "000000" ? "111111" : "000000");

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof PhoneVerificationError, String(error));
    return error;
  }
  assert.fail("une PhoneVerificationError était attendue");
}

async function inactiveProject(prisma: PrismaClient, numero: string) {
  return prisma.project.create({
    data: { name: "Boutique", numero, instanceName: crypto.randomUUID(), status: "inactive" },
  });
}

/** Recule l’horloge des codes du compte : délai de renvoi écoulé. */
const later = (prisma: PrismaClient, userId: string) =>
  prisma.$executeRaw`UPDATE phone_verification SET "createdAt" = "createdAt" - interval '61 seconds' WHERE "userId" = ${userId}`;

test("the number is shown in full and the message carries the code", () => {
  assert.equal(formatVerificationNumber("+24166000039"), "+241 66 00 00 39");
  assert.equal(formatVerificationNumber("33612345678"), "+33 6 12 34 56 78");
  const text = verificationMessage("042917");
  assert.match(text, /042917/);
  assert.match(text, /10 minutes/);
});

test("a typed number is proved by WhatsApp code before anything is saved", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const user = await createUser(prisma, "Owner");
    const other = await createUser(prisma, "Other");
    const device = phone();
    const send = (numero: string, available = true) =>
      sendVerificationCode(prisma, { userId: user.id, target: { numero } }, device.send, available);
    const confirm = (verificationId: string, code: string, userId = user.id) =>
      confirmVerificationCode(prisma, { userId, verificationId, code });
    const proofOf = (verificationId: string, numero: string, userId = user.id) =>
      usableNumberProof(prisma, { verificationId, userId, numero });

    // WhatsApp non configuré ou numéro invalide : rien ne part.
    assert.equal((await failure(send("+24166000001", false))).code, "UNAVAILABLE");
    assert.equal((await failure(send("12"))).code, "INVALID_NUMBER");
    assert.equal(device.inbox.length, 0);
    assert.equal(await prisma.phoneVerification.count(), 0);

    // Premier envoi : au numéro saisi, valable 10 minutes, jamais stocké en clair.
    const typo = await send("+24166000001");
    assert.deepEqual(device.inbox.map((message) => message.digits), ["24166000001"]);
    assert.equal(device.inbox[0].text, verificationMessage(device.code()));
    assert.ok(Math.abs(typo.expiresAt.getTime() - (Date.now() + CODE_TTL_MS)) < 10000);
    assert.ok(typo.resendAt.getTime() - Date.now() <= 60000);
    const row = await prisma.phoneVerification.findUniqueOrThrow({ where: { id: typo.verificationId } });
    assert.match(row.codeHash, /^[0-9a-f]{64}$/);
    assert.equal(row.codeHash, hashVerificationCode(row.id, device.code()));
    assert.equal(row.numberHash, hashTrialNumber("24166000001"));
    assert.equal(row.projectId, null);
    const typoCode = device.code();

    // Renvoi immédiat au même numéro refusé, avec le délai à attendre.
    const tooSoon = await failure(send("+24166000001"));
    assert.equal(tooSoon.code, "RATE_LIMITED");
    assert.ok(tooSoon.retryAfterSeconds! > 0 && tooSoon.retryAfterSeconds! <= 60);

    // Numéro corrigé : le code part tout de suite, l’ancien ne vaut plus rien.
    const fixed = await send("+24166000002");
    assert.equal(device.inbox.at(-1)!.digits, "24166000002");
    assert.equal((await failure(confirm(typo.verificationId, typoCode))).code, "EXPIRED");
    const code = device.code();

    // Mauvais code : compté, essais restants annoncés.
    const mistake = await failure(confirm(fixed.verificationId, wrong(code)));
    assert.equal(mistake.code, "WRONG_CODE");
    assert.match(mistake.message, /4 essais/);
    assert.equal((await failure(confirm(fixed.verificationId, "abcdef"))).code, "WRONG_CODE");
    // Le code d’un autre compte n’est ni lisible ni utilisable.
    assert.equal((await failure(confirm(fixed.verificationId, code, other.id))).code, "EXPIRED");
    assert.equal(await proofOf(fixed.verificationId, "+24166000002"), null);

    // Bon code : la preuve vaut pour ce compte et ce numéro seulement.
    assert.deepEqual(await confirm(fixed.verificationId, code), { verificationId: fixed.verificationId });
    assert.deepEqual(await confirm(fixed.verificationId, code), { verificationId: fixed.verificationId });
    assert.ok((await proofOf(fixed.verificationId, "+24166000002"))?.verifiedAt);
    assert.equal(await proofOf(fixed.verificationId, "+24166000001"), null);
    assert.equal(await proofOf(fixed.verificationId, "+24166000002", other.id), null);

    // Elle n’enregistre qu’un seul projet.
    const first = await inactiveProject(prisma, "+24166000002");
    const proof = { verificationId: fixed.verificationId, userId: user.id, numero: "+24166000002" };
    assert.equal(await consumeNumberProof(prisma, { ...proof, projectId: first.id }), true);
    const second = await inactiveProject(prisma, "+24166000002");
    assert.equal(await consumeNumberProof(prisma, { ...proof, projectId: second.id }), false);
    assert.equal(await proofOf(fixed.verificationId, "+24166000002"), null);

    // Projet annulé (paiement impossible à préparer) : la preuve resservira.
    await releaseNumberProof(prisma, proof);
    assert.equal(await proofOf(fixed.verificationId, "+24166000002"), null);
    await prisma.project.delete({ where: { id: first.id } });
    await releaseNumberProof(prisma, proof);
    assert.ok(await proofOf(fixed.verificationId, "+24166000002"));
    assert.equal(await consumeNumberProof(prisma, { ...proof, projectId: second.id }), true);

    // Au-delà de 30 minutes, il faut un nouveau code.
    await prisma.project.delete({ where: { id: second.id } });
    await releaseNumberProof(prisma, proof);
    await prisma.$executeRaw`UPDATE phone_verification SET "verifiedAt" = "verifiedAt" - interval '31 minutes' WHERE id = ${fixed.verificationId}`;
    assert.equal(await proofOf(fixed.verificationId, "+24166000002"), null);
  });
});

test("codes lock after five tries, expire and are limited per account", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const user = await createUser(prisma, "Owner");
    const device = phone();
    const send = (numero = "+24166000003") =>
      sendVerificationCode(prisma, { userId: user.id, target: { numero } }, device.send, true);
    const confirm = (verificationId: string, code: string) =>
      confirmVerificationCode(prisma, { userId: user.id, verificationId, code });

    // Cinq essais au plus : le bon code ne passe plus ensuite.
    const locked = await send();
    const code = device.code();
    for (const left of ["4 essais", "3 essais", "2 essais", "1 essai."])
      assert.match((await failure(confirm(locked.verificationId, wrong(code)))).message, new RegExp(left));
    assert.equal((await failure(confirm(locked.verificationId, wrong(code)))).code, "TOO_MANY_ATTEMPTS");
    assert.equal((await failure(confirm(locked.verificationId, code))).code, "TOO_MANY_ATTEMPTS");

    // Code expiré au bout de 10 minutes.
    await later(prisma, user.id);
    const stale = await send();
    await prisma.$executeRaw`UPDATE phone_verification SET "expiresAt" = "expiresAt" - interval '11 minutes' WHERE id = ${stale.verificationId}`;
    assert.equal((await failure(confirm(stale.verificationId, device.code()))).code, "EXPIRED");

    // Cinq codes par heure et par compte, même en changeant de numéro à chaque fois.
    await send("+24166000004");
    await send("+24166000005");
    await send("+24166000006");
    const hourly = await failure(send("+24166000007"));
    assert.equal(hourly.code, "RATE_LIMITED");
    assert.equal(hourly.retryAfterSeconds, 3600);
    assert.equal(device.inbox.length, 5);
  });
});

test("an unpaid project's number is proved only by its billing team", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const owner = await createUser(prisma, "Owner");
    const billing = await createUser(prisma, "Billing");
    const agent = await createUser(prisma, "Agent");
    const stranger = await createUser(prisma, "Stranger");
    const project = await inactiveProject(prisma, "24166000008");
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, billing.id, "BILLING");
    await addMember(prisma, project.id, agent.id, "AGENT");
    const device = phone();
    const target: VerificationTarget = { projectId: project.id };
    const send = (userId: string) =>
      sendVerificationCode(prisma, { userId, target }, device.send, true);

    // Ni un agent ni un inconnu ne déclenchent d’envoi sur le téléphone du client.
    for (const userId of [agent.id, stranger.id])
      assert.equal((await failure(send(userId))).code, "FORBIDDEN");
    assert.equal(device.inbox.length, 0);

    // Le responsable facturation reçoit le code au numéro du projet.
    const sent = await send(billing.id);
    assert.equal(device.inbox[0].digits, "24166000008");
    await confirmVerificationCode(prisma, {
      userId: billing.id,
      verificationId: sent.verificationId,
      code: device.code(),
    });
    assert.ok(
      await usableNumberProof(prisma, {
        verificationId: sent.verificationId,
        userId: billing.id,
        numero: project.numero,
      }),
    );

    // Numéro déjà prouvé, projet payé ou en suppression : plus rien à envoyer.
    await prisma.project.update({ where: { id: project.id }, data: { numeroVerifiedAt: new Date() } });
    assert.equal((await failure(send(owner.id))).code, "ALREADY_VERIFIED");
    for (const data of [{ status: "active" as const }, { deletionPending: true }]) {
      await prisma.project.update({
        where: { id: project.id },
        data: { ...data, numeroVerifiedAt: null },
      });
      assert.equal((await failure(send(owner.id))).code, "NOT_NEEDED");
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "inactive", deletionPending: false },
      });
    }
  });
});

test("a failed send leaves no code behind and limits hold across accounts", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const user = await createUser(prisma, "Owner");
    const device = phone();
    const send = (userId: string, numero: string, sender: OtpSender) =>
      sendVerificationCode(prisma, { userId, target: { numero } }, sender, true);
    const count = (userId: string) => prisma.phoneVerification.count({ where: { userId } });

    // Panne de l’envoi : rien n’est gardé, aucun délai imposé.
    const down = await failure(
      send(user.id, "+24166000009", async () => {
        throw new Error("network down");
      }),
    );
    assert.equal(down.code, "SEND_FAILED");
    assert.equal(await count(user.id), 0);

    // Pas de compte WhatsApp sur ce numéro : l’utilisateur doit le corriger.
    const missing = await failure(
      send(user.id, "+24166000009", async () => {
        throw new PhoneVerificationError("Ce numéro n’a pas de compte WhatsApp.", "NOT_ON_WHATSAPP");
      }),
    );
    assert.equal(missing.code, "NOT_ON_WHATSAPP");
    assert.equal(await count(user.id), 0);
    await send(user.id, "+24166000009", device.send);
    assert.equal(await count(user.id), 1);

    // Compte resté à l’ancienne numérotation gabonaise : le code part sous
    // « 241 06… », le même numéro que celui saisi.
    const legacyUser = await createUser(prisma, "Legacy");
    const legacy = phone();
    await send(legacyUser.id, "+241 66 00 00 12", async (digits, text) => {
      if (digits !== "24106000012")
        throw new PhoneVerificationError("Ce numéro n’a pas de compte WhatsApp.", "NOT_ON_WHATSAPP");
      await legacy.send(digits, text);
    });
    assert.deepEqual(legacy.inbox.map((message) => message.digits), ["24106000012"]);
    assert.equal(await count(legacyUser.id), 1);

    const seed = (data: { userId: string; numberHash: string }, ageHours = 1) =>
      prisma.phoneVerification.create({
        data: {
          ...data,
          codeHash: "0".repeat(64),
          expiresAt: new Date(Date.now() - 60000),
          createdAt: new Date(Date.now() - ageHours * 3600000),
        },
      });

    // Dix codes par jour vers un même numéro, quel que soit le compte.
    const numero = "+24166000010";
    const someone = await createUser(prisma, "Someone");
    for (let index = 0; index < 10; index++)
      await seed({ userId: someone.id, numberHash: hashTrialNumber(numero) }, index ? 2 : 25);
    const attacker = await createUser(prisma, "Attacker");
    // Le plus ancien a plus d’un jour : il ne compte plus, le dixième passe.
    await send(attacker.id, numero, device.send);
    await later(prisma, attacker.id);
    const daily = await failure(send(attacker.id, numero, device.send));
    assert.equal(daily.code, "RATE_LIMITED");
    assert.equal(daily.retryAfterSeconds, 86400);

    // Quinze codes par jour et par compte, tous numéros confondus.
    const busy = await createUser(prisma, "Busy");
    for (let index = 0; index < 15; index++)
      await seed({ userId: busy.id, numberHash: crypto.randomUUID() }, 2);
    const perDay = await failure(send(busy.id, "+24166000011", device.send));
    assert.equal(perDay.code, "RATE_LIMITED");
    assert.equal(perDay.retryAfterSeconds, 86400);
    assert.equal(await count(busy.id), 15);
  });
});

/** Message WhatsApp reçu par le numéro d’ExtravertyAI, tel qu’Evolution le transmet. */
function incoming(text: string, sender: string, extra: Record<string, unknown> = {}) {
  return {
    key: { id: crypto.randomUUID(), remoteJid: sender, fromMe: false, ...extra },
    message: { conversation: text },
  };
}

test("the sender is read from WhatsApp, even behind a hidden identifier", () => {
  assert.equal(senderNumberDigits({ remoteJid: "24166000039@s.whatsapp.net" }), "24166000039");
  assert.equal(senderNumberDigits({ remoteJid: "24166000039:12@s.whatsapp.net" }), "24166000039");
  assert.equal(
    senderNumberDigits({ remoteJid: "123456789012345@lid", remoteJidAlt: "24166000039@s.whatsapp.net" }),
    "24166000039",
  );
  assert.equal(
    senderNumberDigits({ remoteJid: "123456789012345@lid", senderPn: "24166000039@s.whatsapp.net" }),
    "24166000039",
  );
  assert.equal(senderNumberDigits({ remoteJid: "123456789012345@lid" }), null);
  assert.equal(senderNumberDigits({ remoteJid: "120363000000000000@g.us" }), null);
  assert.equal(senderNumberDigits({ remoteJid: "../x@s.whatsapp.net" }), null);
  assert.ok(isOtpInstance("extravertyai-otp"));
  assert.equal(isOtpInstance("ext_123_abcde"), false);
});

test("the customer proves the number by sending the code from it", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const user = await createUser(prisma, "Owner");
    const other = await createUser(prisma, "Other");
    const start = (numero = "+24166000020", userId = user.id, available = true) =>
      startInboundVerification(prisma, { userId, target: { numero } }, available);
    const status = (verificationId: string, userId = user.id) =>
      verificationStatus(prisma, { userId, verificationId });

    assert.equal((await failure(start("+24166000020", user.id, false))).code, "UNAVAILABLE");

    // Code à envoyer vers le numéro d’ExtravertyAI, message déjà écrit.
    const pending = await start();
    assert.match(pending.code, /^\d{6}$/);
    assert.equal(pending.text, inboundMessage(pending.code));
    assert.equal(
      pending.link,
      `https://wa.me/24176205629?text=${encodeURIComponent(pending.text)}`,
    );
    assert.equal(pending.to, "+241 76 20 56 29");
    assert.ok(Math.abs(pending.expiresAt.getTime() - (Date.now() + CODE_TTL_MS)) < 10000);
    const row = await prisma.phoneVerification.findUniqueOrThrow({ where: { id: pending.verificationId } });
    assert.equal(row.direction, "INBOUND");
    assert.equal(row.codeHash, hashVerificationCode(row.id, pending.code));
    assert.equal(await status(pending.verificationId), "pending");

    // Recopier ce code ne prouve rien : il faut l’envoyer depuis le numéro.
    assert.equal(
      (await failure(confirmVerificationCode(prisma, {
        userId: user.id,
        verificationId: pending.verificationId,
        code: pending.code,
      }))).code,
      "EXPIRED",
    );

    // Bon code envoyé depuis un autre numéro : refusé, avec une explication.
    const intruder = await receiveVerificationMessage(
      prisma,
      incoming(pending.text, "24166999999@s.whatsapp.net"),
    );
    assert.deepEqual(intruder, { digits: "24166999999", reply: INBOUND_REPLIES.unknown });
    // Message sans rapport, message envoyé par nous, ou sans code : ignorés.
    assert.equal(await receiveVerificationMessage(prisma, incoming(`Livraison ${wrong(pending.code)} ?`, "24166000020@s.whatsapp.net")), null);
    assert.equal(
      await receiveVerificationMessage(prisma, incoming(pending.text, "24166000020@s.whatsapp.net", { fromMe: true })),
      null,
    );
    assert.equal(await receiveVerificationMessage(prisma, incoming("Bonjour ExtravertyAI", "24166000020@s.whatsapp.net")), null);
    assert.equal(await receiveVerificationMessage(prisma, { nothing: true }), null);
    assert.equal(await status(pending.verificationId), "pending");

    // Envoyé depuis le bon numéro, même caché derrière un @lid : numéro prouvé.
    const proved = await receiveVerificationMessage(
      prisma,
      incoming(pending.text, "123456789012345@lid", { remoteJidAlt: "24166000020@s.whatsapp.net" }),
    );
    assert.deepEqual(proved, { digits: "24166000020", reply: INBOUND_REPLIES.verified });
    assert.equal(await status(pending.verificationId), "verified");
    // L’état n’est lisible que par son compte.
    assert.equal(await status(pending.verificationId, other.id), "expired");
    assert.ok(
      await usableNumberProof(prisma, {
        verificationId: pending.verificationId,
        userId: user.id,
        numero: "+24166000020",
      }),
    );
    // Un second envoi du même message (ou un webhook rejoué) ne refait rien et
    // reçoit la même réponse, jamais « code non valable » après un succès.
    const verifiedAt = (await prisma.phoneVerification.findUniqueOrThrow({
      where: { id: pending.verificationId },
    })).verifiedAt;
    assert.deepEqual(
      await receiveVerificationMessage(prisma, incoming(pending.text, "24166000020@s.whatsapp.net")),
      { digits: "24166000020", reply: INBOUND_REPLIES.verified },
    );
    assert.deepEqual(
      (await prisma.phoneVerification.findUniqueOrThrow({ where: { id: pending.verificationId } }))
        .verifiedAt,
      verifiedAt,
    );

    // Nouveau code : le précédent, pas encore envoyé, ne vaut plus rien.
    const first = await start("+24166000021");
    const second = await start("+24166000021");
    assert.equal(await status(first.verificationId), "expired");
    const late = await receiveVerificationMessage(
      prisma,
      incoming(first.text, "24166000021@s.whatsapp.net"),
    );
    assert.equal(late?.reply, INBOUND_REPLIES.unknown);
    assert.equal(await status(second.verificationId), "pending");

    // Code expiré au bout de 10 minutes.
    await prisma.$executeRaw`UPDATE phone_verification SET "expiresAt" = "expiresAt" - interval '11 minutes' WHERE id = ${second.verificationId}`;
    assert.equal(await status(second.verificationId), "expired");
    const expired = await receiveVerificationMessage(
      prisma,
      incoming(second.text, "24166000021@s.whatsapp.net"),
    );
    assert.equal(expired?.reply, INBOUND_REPLIES.unknown);

    // Numéro saisi « +241 77… », WhatsApp écrit depuis l’ancienne écriture
    // « 241 07… » : c’est le même numéro, il est prouvé.
    const modern = await start("+241 77 00 00 22", other.id);
    assert.deepEqual(
      await receiveVerificationMessage(
        prisma,
        incoming(modern.text, "123456789012399@lid", { remoteJidAlt: "24107000022@s.whatsapp.net" }),
      ),
      { digits: "24107000022", reply: INBOUND_REPLIES.verified },
    );
    assert.equal(await status(modern.verificationId, other.id), "verified");
    assert.ok(
      await usableNumberProof(prisma, {
        verificationId: modern.verificationId,
        userId: other.id,
        numero: "+24177000022",
      }),
    );
  });
});

test("codes to send do not use the sending quota and are limited apart", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const user = await createUser(prisma, "Owner");
    const device = phone();
    for (let index = 0; index < 20; index++)
      await startInboundVerification(
        prisma,
        { userId: user.id, target: { numero: `+241660001${String(index).padStart(2, "0")}` } },
        true,
      );
    const hourly = await failure(
      startInboundVerification(prisma, { userId: user.id, target: { numero: "+24166000199" } }, true),
    );
    assert.equal(hourly.code, "RATE_LIMITED");
    assert.equal(hourly.retryAfterSeconds, 3600);
    // Aucun message n’est parti : le code reçu reste possible en secours.
    await sendVerificationCode(prisma, { userId: user.id, target: { numero: "+24166000199" } }, device.send, true);
    assert.equal(device.inbox.length, 1);

    // Un projet non payé : seule l’équipe facturation prépare le code.
    const agent = await createUser(prisma, "Agent");
    const project = await inactiveProject(prisma, "24166000150");
    await addMember(prisma, project.id, agent.id, "AGENT");
    const target: VerificationTarget = { projectId: project.id };
    assert.equal(
      (await failure(startInboundVerification(prisma, { userId: agent.id, target }, true))).code,
      "FORBIDDEN",
    );
  });
});
