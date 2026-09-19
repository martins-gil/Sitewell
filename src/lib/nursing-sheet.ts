import { z } from "zod";

/**
 * The standard nursing record for a visit type ("Documento fonte – Registos de
 * enfermagem"): a few sections (vital signs, blood/urine collections…), each a
 * table of rows for the nurse to fill in by hand — a result, a time, an
 * observation. It's a printed source document, so what's stored is the
 * DEFINITION (which tasks, which columns); the recorded values are written on
 * paper. Stored as JSON on VisitScheduleTemplate.nursingSheet.
 */
const row = z.object({
  label: z.string().trim().min(1, "Every row needs a name.").max(200),
  // Number of measurement lines for this row (e.g. blood pressure taken 3 times).
  readings: z.number().int().min(1).max(10),
  // Extra text printed beside the row, e.g. "(Braço direito/Braço esquerdo)".
  note: z.string().trim().max(200),
});

const section = z
  .object({
    title: z.string().trim().min(1, "Every section needs a title.").max(120),
    // Header band across the table, e.g. "Pré-dose". Blank = no band.
    timepoint: z.string().trim().max(60),
    columns: z.object({ result: z.boolean(), time: z.boolean(), observations: z.boolean() }),
    // Text in the top-left header cell, e.g. "Parâmetro".
    firstColumnHeader: z.string().trim().max(200),
    // Show the visit's linked kits in that header cell (like the kit row on the
    // blood-collection table of the paper form).
    includeKits: z.boolean(),
    footnote: z.string().trim().max(300),
    rows: z.array(row).min(1, "Every section needs at least one row.").max(40),
  })
  .refine((s) => s.columns.result || s.columns.time || s.columns.observations, {
    message: "Pick at least one column (result, time or observations) for each section.",
  });

export const nursingSheetSchema = z.object({
  // Second title line, e.g. "OLE Y1 Q4W". Blank = none.
  subtitle: z.string().trim().max(120),
  // Label of the box that carries the visit's name, e.g. "Week/Dia" or "Ciclo/Dia".
  visitLabel: z.string().trim().min(1, "Visit label is required.").max(40),
  signature: z.boolean(),
  sections: z.array(section).min(1, "Add at least one section.").max(10),
});

export type NursingSheetRow = z.infer<typeof row>;
export type NursingSheetSection = z.infer<typeof section>;
export type NursingSheet = z.infer<typeof nursingSheetSchema>;

/** The stored sheet, or null if there isn't one (or it no longer validates). */
export function parseNursingSheet(json: unknown): NursingSheet | null {
  if (json === null || json === undefined) return null;
  const parsed = nursingSheetSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

const r = (label: string, readings = 1, note = ""): NursingSheetRow => ({ label, readings, note });

/** What a visit prints when its visit type hasn't customised a sheet: nursing
 * records are standard, so every visit can download one straight away. Defined
 * below from the first preset. */
export function defaultNursingSheet(): NursingSheet {
  return structuredClone(NURSING_SHEET_PRESETS[0].sheet);
}

/** Starting points, modelled on the site's two paper nursing records. */
export const NURSING_SHEET_PRESETS: { id: string; label: string; sheet: NursingSheet }[] = [
  {
    id: "result-and-time",
    label: "Vital signs with result + time, blood/urine collection",
    sheet: {
      subtitle: "",
      visitLabel: "Week/Dia",
      signature: false,
      sections: [
        {
          title: "Avaliação dos Sinais Vitais",
          timepoint: "Pré-dose",
          columns: { result: true, time: true, observations: false },
          firstColumnHeader: "",
          includeKits: false,
          footnote: "(*) avaliar com pelo menos 1 minuto de intervalo",
          rows: [
            r("Pressão arterial * (mmHg)", 3),
            r("Pulso (bpm)"),
            r("Temperatura (ºC)", 1, "Localização: ______________"),
            r("Taxa de respiração (ciclos/min)"),
            r("Peso (Kg)"),
          ],
        },
        {
          title: "Colheitas de Sangue",
          timepoint: "Pré-dose",
          columns: { result: false, time: true, observations: true },
          firstColumnHeader: "",
          includeKits: true,
          footnote: "",
          rows: [r("Sangue"), r("Urina")],
        },
      ],
    },
  },
  {
    id: "result-and-observations",
    label: "Vital signs with result + observations, collections log, signature",
    sheet: {
      subtitle: "",
      visitLabel: "Ciclo/Dia",
      signature: true,
      sections: [
        {
          title: "Log de Avaliação dos Sinais Vitais",
          timepoint: "Pré-Dose",
          columns: { result: true, time: false, observations: true },
          firstColumnHeader: "Parâmetro",
          includeKits: false,
          footnote: "",
          rows: [
            r("Pressão arterial (mmHg)", 1, "(Braço direito/Braço esquerdo)"),
            r("Frequência cardíaca (bpm)"),
            r("Frequência respiratória (rpm)"),
            r("Saturação do oxigénio (%)"),
            r("Temperatura (ºC)", 1, "(Axilar/Frontal/Timpânica)"),
            r("Peso (Kg)"),
          ],
        },
        {
          title: "Log de Colheitas",
          timepoint: "",
          columns: { result: false, time: true, observations: true },
          firstColumnHeader: "Lab. Local: Hemograma completo, bioquímica e função tiroidea",
          includeKits: true,
          footnote: "",
          rows: [r("Pré-dose:")],
        },
      ],
    },
  },
];
