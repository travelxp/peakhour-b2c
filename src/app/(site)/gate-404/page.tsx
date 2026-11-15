import { notFound } from "next/navigation";

/**
 * Where the coming-soon gate rewrites a path that matches no route
 * (middleware.ts). Renders the public 404 with a real 404 status, so an unknown
 * URL answers 404 while the gate is on, not the teaser. Reached only by that
 * rewrite; asked for directly it is a 404 too, and the gate sends it here.
 */
export default function GateNotFound(): never {
  notFound();
}
