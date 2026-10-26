import { permanentRedirect } from "next/navigation";

// L’ancienne page Tarifs est remplacée par la section tarifs de l’accueil ;
// les anciens liens et favoris y mènent directement.
export default function TarifsPage() {
  permanentRedirect("/#tarifs");
}
