<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI components

For the design and implementation of every UI element—including buttons, forms, tables, inputs, dialogs, menus, and any other interface component—always use the project's existing shadcn/ui components. Reuse or compose components from `components/ui/` instead of creating custom replacements. If a required shadcn/ui component is missing, add it following the project's existing shadcn/ui conventions, then use that component.

Always use the project's configured shadcn/ui theme for the entire interface. Rely on its existing semantic design tokens and utilities—such as `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, and the configured radius—rather than introducing hard-coded colors, arbitrary visual values, parallel themes, or component-specific styling systems. Any new UI must remain visually consistent with the project's shadcn/ui theme in both light and dark modes.

### Forms and validation

All client-side forms must follow the project's standard shadcn/ui form pattern:

- Use `react-hook-form` with `useForm` for form state and submission.
- Define validation schemas with Zod and infer form data types with `z.infer<typeof schema>`.
- Connect Zod to React Hook Form with `zodResolver` from `@hookform/resolvers/zod`.
- Use `Controller` for controlled fields and render validation state through `fieldState`.
- Build form layouts with the project's shadcn/ui components, especially `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, and `FieldError`, together with the appropriate `Input`, `Textarea`, `Select`, `Checkbox`, `InputGroup`, or other shadcn/ui control.
- Set `data-invalid` and `aria-invalid` from `fieldState.invalid`, associate every label with a stable field `id`, and display validation feedback with `FieldError`.
- Provide explicit `defaultValues`, appropriate autocomplete attributes, accessible descriptions, loading/disabled states, and clear reset and submit behavior.
- Use the project's `Button`, `Card`, and related shadcn/ui components for actions and form containers when appropriate.
- Use Sonner (`toast`) for user-facing success and error feedback when a toast is appropriate.
- Follow the structure and conventions of the supplied `BugReportForm` example as the reference implementation; do not introduce a different form abstraction unless the task explicitly requires it.
- Repeat critical validation and authorization on the server. Client-side Zod validation is for user experience and must never be treated as a security boundary.

## Product quality, UI/UX, and security

All generated code must meet the standard of a professional technology startup with strong expertise in UI/UX and cybersecurity. Interfaces must be polished, consistent, responsive, accessible, and designed around clear user feedback, predictable interaction states, keyboard navigation, mobile usability, and sensible empty, loading, success, and error states.

Security must be considered by default: validate and normalize untrusted input, enforce authentication and authorization server-side, minimize exposed data, protect secrets, avoid unsafe HTML and insecure client-side trust, use safe error messages, preserve tenant isolation, and follow least-privilege principles. Do not trade security, accessibility, maintainability, or user experience for implementation speed.
