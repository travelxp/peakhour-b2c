/** The shape of a next-intl translator, loosened to what a view component needs, so a sync view renders with a server `getTranslations` result or a plain `createTranslator` (tests). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;
