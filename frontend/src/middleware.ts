export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/wallet/:path*", "/groups/:path*", "/loans/:path*"],
};
