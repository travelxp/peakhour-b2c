import { getRequestConfig } from "next-intl/server";
import { defaultLocale, type AppLocale } from "./config";

/**
 * i18n request config — English-only for now.
 *
 * The locale is fixed to `en` (see ./config) until more languages are added.
 * When they are, resolve it here from the request (a locale cookie,
 * `Accept-Language`, or a future URL segment) and add `messages/<locale>.json`
 * — no component changes needed. Kept deliberately minimal so this scaffold is
 * inert until strings are migrated into `messages/` incrementally.
 */
export default getRequestConfig(async () => {
  const locale: AppLocale = defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
