// The SiteWell-ct logo and the pictures that rotate on the sign-in page. The files
// live in public/brand/ and are listed here, so adding one is: put the file in that
// folder and add its path below.
//
//   LOGO_SRC         the logo (dark blue on transparent), shown at the top of the sidebar and
//                    on the sign-in page in the light theme.
//                    null = the plain "SiteWell-ct" wordmark until a logo file is added.
//   LOGO_SRC_WHITE   the same logo in white, on the SAME canvas size, shown instead of it in
//                    the dark theme. null = the dark logo on a light chip.
//   LOGIN_IMAGES     the pictures for the sign-in page. Each sign-in page load shows the
//                    next one in turn. Empty = a plain coloured panel.

export const LOGO_SRC: string | null = "/brand/sitewell-logo.png";

export const LOGO_SRC_WHITE: string | null = "/brand/sitewell-logo-white.png";

export const LOGIN_IMAGES: string[] = ["/brand/login-1.jpg", "/brand/login-2.jpg", "/brand/login-3.jpg"];
