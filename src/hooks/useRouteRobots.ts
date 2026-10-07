import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const INDEXABLE = 'index,follow,max-image-preview:large';
const PRIVATE_PREFIXES = ['/auth', '/app'];

/**
 * index.html ships one set of head tags for every route. Pages that should not
 * be indexed (sign-in and the app) flip the robots meta tag on route change.
 * Googlebot renders JavaScript, so it reads the updated tag.
 */
export function useRouteRobots() {
  const { pathname } = useLocation();
  useEffect(() => {
    const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    let tag = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'robots';
      document.head.appendChild(tag);
    }
    tag.content = isPrivate ? 'noindex,nofollow' : INDEXABLE;
  }, [pathname]);
}
