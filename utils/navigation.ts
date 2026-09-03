import type { Href, ImperativeRouter } from "expo-router";

export function goBackOrReplace(router: ImperativeRouter, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}

export function goBackOrPush(router: ImperativeRouter, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.push(fallback);
}
