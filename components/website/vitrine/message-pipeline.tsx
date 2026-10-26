"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  PIPELINE_EDGES,
  PIPELINE_NODES,
  PIPELINE_ROUTES,
  PIPELINE_STAGES,
  type PipelineNode,
  type PipelineNodeId,
} from "./data";
import { EASE_OUT, useAutoplay } from "./motion";

const ROUTE_DURATION_MS = 4200;
const STEP_DELAY_S = 0.42;

interface EdgePath {
  id: string;
  from: PipelineNodeId;
  to: PipelineNodeId;
  d: string;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** Bezier connector: horizontal between columns, vertical when stages stack. */
function connector(a: DOMRect, b: DOMRect, origin: DOMRect): string {
  const ax = a.left - origin.left;
  const ay = a.top - origin.top;
  const bx = b.left - origin.left;
  const by = b.top - origin.top;

  if (bx >= ax + a.width - 1) {
    const sx = round(ax + a.width);
    const sy = round(ay + a.height / 2);
    const ex = round(bx);
    const ey = round(by + b.height / 2);
    const bend = round((ex - sx) / 2);
    return `M ${sx} ${sy} C ${sx + bend} ${sy}, ${ex - bend} ${ey}, ${ex} ${ey}`;
  }

  const sx = round(ax + a.width / 2);
  const sy = round(ay + a.height);
  const ex = round(bx + b.width / 2);
  const ey = round(by);
  const bend = round((ey - sy) / 2);
  return `M ${sx} ${sy} C ${sx} ${sy + bend}, ${ex} ${ey - bend}, ${ex} ${ey}`;
}

export function MessagePipeline() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<PipelineNodeId, HTMLElement>());
  const [paths, setPaths] = useState<EdgePath[]>([]);
  const [routeIndex, setRouteIndex] = useState(0);
  const [selected, setSelected] = useState<PipelineNodeId>("agent");
  const [paused, setPaused] = useState(false);
  const { ref, canPlay, reduce } = useAutoplay<HTMLDivElement>(0.3);

  const route = PIPELINE_ROUTES[routeIndex];
  const running = canPlay && !paused;

  // Connectors are measured from the real layout, so they follow every breakpoint.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const origin = canvas.getBoundingClientRect();
      setPaths(
        PIPELINE_EDGES.flatMap(([from, to]) => {
          const a = nodeRefs.current.get(from);
          const b = nodeRefs.current.get(to);
          if (!a || !b) return [];
          return [
            {
              id: `${from}-${to}`,
              from,
              to,
              d: connector(a.getBoundingClientRect(), b.getBoundingClientRect(), origin),
            },
          ];
        }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    nodeRefs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(
      () => setRouteIndex((index) => (index + 1) % PIPELINE_ROUTES.length),
      ROUTE_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [running, routeIndex]);

  const routeEdges = route.nodes.slice(1).map((to, index) => `${route.nodes[index]}-${to}`);
  const selectedNode = PIPELINE_NODES.find((node) => node.id === selected) ?? PIPELINE_NODES[4];

  const chooseRoute = (index: number) => {
    setRouteIndex(index);
    setPaused(true);
  };

  return (
    <div ref={ref} className="grid border-t xl:grid-cols-12">
      <div className="min-w-0 xl:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-8 lg:px-12">
          <div role="group" aria-label="Choisir un parcours" className="flex flex-wrap gap-1">
            {PIPELINE_ROUTES.map((item, index) => (
              <Button
                key={item.id}
                type="button"
                size="xs"
                variant={index === routeIndex ? "secondary" : "ghost"}
                aria-pressed={index === routeIndex}
                onClick={() => chooseRoute(index)}
                className="font-mono text-[11px]"
              >
                <span className="text-muted-foreground">0{index + 1}</span>
                {item.short}
              </Button>
            ))}
          </div>
          {!reduce && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? "Reprendre l’animation du parcours" : "Mettre l’animation du parcours en pause"}
            >
              {paused ? <Play /> : <Pause />}
              <span aria-hidden="true">{paused ? "Lecture" : "Pause"}</span>
            </Button>
          )}
        </div>

        <div className="px-4 pb-10 pt-6 sm:px-8 lg:px-12">
          <p className="mb-10 min-h-5 font-mono text-xs text-muted-foreground">
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={route.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="inline-block"
              >
                <span className="text-foreground">Parcours :</span> {route.label}
              </m.span>
            </AnimatePresence>
          </p>

          <div ref={canvasRef} className="relative">
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
              {paths.map((path) => (
                <path
                  key={path.id}
                  d={path.d}
                  fill="none"
                  strokeWidth={1}
                  className="stroke-border"
                />
              ))}
              {paths
                .filter((path) => routeEdges.includes(path.id))
                .map((path) => {
                  const order = routeEdges.indexOf(path.id);
                  return (
                    <m.path
                      key={`${route.id}-${path.id}`}
                      d={path.d}
                      fill="none"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      className="stroke-foreground"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{
                        pathLength: { duration: 0.5, delay: order * STEP_DELAY_S + 0.15, ease: "easeInOut" },
                        opacity: { duration: 0.1, delay: order * STEP_DELAY_S + 0.15 },
                      }}
                    />
                  );
                })}
            </svg>

            <div className="relative grid gap-12 md:grid-cols-4 md:gap-8 lg:gap-10">
              {PIPELINE_STAGES.map((stage, stageIndex) => {
                const nodes = PIPELINE_NODES.filter((node) => node.stage === stageIndex);
                const many = nodes.length > 1;
                return (
                  <div key={stage} className="flex flex-col gap-3 md:relative md:justify-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:absolute md:-top-7">
                      <span className="text-foreground">0{stageIndex + 1}</span> {stage}
                    </p>
                    <ul className={cn("grid gap-2 md:gap-3", many && "grid-cols-3 md:grid-cols-1")}>
                      {nodes.map((node) => {
                        const order = route.nodes.indexOf(node.id);
                        return (
                          <li key={node.id}>
                            <PipelineNodeButton
                              node={node}
                              compact={many}
                              selected={selected === node.id}
                              lit={order >= 0}
                              litDelay={order * STEP_DELAY_S}
                              routeKey={route.id}
                              onSelect={() => setSelected(node.id)}
                              register={(element) => {
                                if (element) nodeRefs.current.set(node.id, element);
                                else nodeRefs.current.delete(node.id);
                              }}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <NodeInspector node={selectedNode} />
    </div>
  );
}

interface PipelineNodeButtonProps {
  node: PipelineNode;
  compact: boolean;
  selected: boolean;
  lit: boolean;
  litDelay: number;
  routeKey: string;
  onSelect: () => void;
  register: (element: HTMLElement | null) => void;
}

function PipelineNodeButton({
  node,
  compact,
  selected,
  lit,
  litDelay,
  routeKey,
  onSelect,
  register,
}: PipelineNodeButtonProps) {
  const Icon = node.icon;

  return (
    <Button
      ref={register}
      type="button"
      variant="outline"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative h-auto w-full flex-col items-start justify-start gap-2.5 whitespace-normal rounded-lg bg-background p-3 text-left shadow-none hover:-translate-y-0.5 hover:bg-background hover:shadow-md hover:shadow-foreground/5 motion-reduce:hover:translate-y-0 dark:bg-background dark:hover:bg-background",
        compact && "items-center px-2 text-center md:items-start md:px-3 md:text-left",
        selected && "border-foreground ring-3 ring-ring/30 dark:border-foreground",
      )}
    >
      <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        <Icon aria-hidden="true" className="size-4" />
        {/* The lit state carries its own icon, so the base one is never left unreadable mid-transition. */}
        <AnimatePresence>
          {lit && (
            <m.span
              key={routeKey}
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-primary text-primary-foreground"
              initial={{ clipPath: "circle(0% at 50% 50%)" }}
              animate={{ clipPath: "circle(75% at 50% 50%)" }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, ease: EASE_OUT, delay: litDelay }}
            >
              <Icon className="size-4" />
            </m.span>
          )}
        </AnimatePresence>
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium sm:text-sm">{node.title}</span>
        <span
          className={cn(
            "block font-mono text-[11px] font-normal text-muted-foreground",
            compact && "hidden md:block",
          )}
        >
          {node.caption}
        </span>
      </span>
    </Button>
  );
}

function NodeInspector({ node }: { node: PipelineNode }) {
  const Icon = node.icon;

  return (
    <aside
      aria-label="Détail de l’étape sélectionnée"
      className="border-t bg-muted/30 xl:col-span-4 xl:border-l xl:border-t-0"
    >
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-8 lg:px-12 xl:px-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Inspecteur</p>
        <p className="font-mono text-[11px] text-muted-foreground">Cliquez sur une étape</p>
      </div>
      <div aria-live="polite" className="px-4 py-8 sm:px-8 lg:px-12 xl:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={node.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="md:grid md:grid-cols-2 md:items-end md:gap-12 xl:block"
          >
            <div>
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Étape 0{node.stage + 1} · {PIPELINE_STAGES[node.stage]}
              </p>
              <h3 className="mt-2 text-3xl tracking-tight">{node.title}</h3>
              <p className="mt-3 text-pretty text-sm text-muted-foreground">{node.description}</p>
            </div>
            <dl className="mt-8 divide-y rounded-lg border bg-background font-mono text-xs md:mt-0 xl:mt-8">
              {node.config.map((entry) => (
                <div key={entry.key} className="flex items-baseline justify-between gap-4 px-3 py-2.5">
                  <dt className="text-muted-foreground">{entry.key}</dt>
                  <dd className="text-right">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </m.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}
