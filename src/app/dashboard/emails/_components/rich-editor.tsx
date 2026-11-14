"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, Bold, Eraser, Heading1, Heading2, Image as ImageIcon, Italic, Link2, List,
  ListOrdered, Minus, Palette, Pilcrow, Redo2, Underline, Undo2, UserRound, Check, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Editor visual muy ligero (contentEditable + execCommand). Pensado para
 * redactar correos o pegar contenido de Word / Google Docs / una web
 * conservando el formato.
 */
export function RichEditor({
  value,
  onChange,
  placeholder = "Escribe o pega aquí el contenido…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [prompt, setPrompt] = useState<null | "link" | "image">(null);
  const [promptValue, setPromptValue] = useState("");

  // Sincroniza cuando el valor cambia desde fuera (plantilla, reutilizar, cambio de modo)
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value && document.activeElement !== el) el.innerHTML = value;
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0);
  };
  const restoreSelection = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const exec = (cmd: string, arg?: string) => {
    restoreSelection();
    document.execCommand(cmd, false, arg);
    saveSelection();
    emit();
  };

  function confirmPrompt() {
    const v = promptValue.trim();
    if (v && /^https?:\/\//i.test(v)) {
      if (prompt === "link") exec("createLink", v);
      if (prompt === "image") exec("insertHTML", `<img src="${v.replace(/"/g, "&quot;")}" alt="" style="max-width:100%;height:auto;border-radius:8px;" />`);
    }
    setPrompt(null);
    setPromptValue("");
  }

  const Btn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()} // no perder la selección
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
  const Sep = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

  return (
    <div className="overflow-hidden rounded-xl border bg-card focus-within:ring-2 focus-within:ring-ring/40">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1">
        <Btn title="Deshacer" onClick={() => exec("undo")}><Undo2 className="size-4" /></Btn>
        <Btn title="Rehacer" onClick={() => exec("redo")}><Redo2 className="size-4" /></Btn>
        <Sep />
        <Btn title="Título grande" onClick={() => exec("formatBlock", "<h1>")}><Heading1 className="size-4" /></Btn>
        <Btn title="Subtítulo" onClick={() => exec("formatBlock", "<h2>")}><Heading2 className="size-4" /></Btn>
        <Btn title="Párrafo" onClick={() => exec("formatBlock", "<p>")}><Pilcrow className="size-4" /></Btn>
        <Sep />
        <Btn title="Negrita" onClick={() => exec("bold")}><Bold className="size-4" /></Btn>
        <Btn title="Cursiva" onClick={() => exec("italic")}><Italic className="size-4" /></Btn>
        <Btn title="Subrayado" onClick={() => exec("underline")}><Underline className="size-4" /></Btn>
        <label
          title="Color del texto"
          onMouseDown={saveSelection}
          className="relative flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Palette className="size-4" />
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => exec("foreColor", e.target.value)} aria-label="Color del texto" />
        </label>
        <Sep />
        <Btn title="Lista" onClick={() => exec("insertUnorderedList")}><List className="size-4" /></Btn>
        <Btn title="Lista numerada" onClick={() => exec("insertOrderedList")}><ListOrdered className="size-4" /></Btn>
        <Btn title="Alinear a la izquierda" onClick={() => exec("justifyLeft")}><AlignLeft className="size-4" /></Btn>
        <Btn title="Centrar" onClick={() => exec("justifyCenter")}><AlignCenter className="size-4" /></Btn>
        <Btn title="Línea separadora" onClick={() => exec("insertHorizontalRule")}><Minus className="size-4" /></Btn>
        <Sep />
        <Btn title="Enlace" onClick={() => { saveSelection(); setPrompt("link"); }}><Link2 className="size-4" /></Btn>
        <Btn title="Imagen (desde una URL)" onClick={() => { saveSelection(); setPrompt("image"); }}><ImageIcon className="size-4" /></Btn>
        <Btn title="Insertar el nombre del cliente" onClick={() => exec("insertText", "{{nombre}}")}><UserRound className="size-4" /></Btn>
        <Sep />
        <Btn title="Quitar formato" onClick={() => exec("removeFormat")}><Eraser className="size-4" /></Btn>
      </div>

      {prompt && (
        <div className="flex items-center gap-2 border-b bg-muted/20 p-2">
          <Input
            autoFocus
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirmPrompt(); }
              if (e.key === "Escape") setPrompt(null);
            }}
            placeholder={prompt === "link" ? "https://… (selecciona antes el texto del enlace)" : "https://…/imagen.jpg"}
            className="h-8"
          />
          <Button type="button" size="sm" className="h-8" onClick={confirmPrompt}><Check className="size-4" /></Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setPrompt(null)}><X className="size-4" /></Button>
        </div>
      )}

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Contenido del correo"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={() => { saveSelection(); emit(); }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        className={cn(
          "min-h-72 max-h-[520px] overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none",
          "[&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-2",
          "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_hr]:my-4",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        )}
      />
    </div>
  );
}
