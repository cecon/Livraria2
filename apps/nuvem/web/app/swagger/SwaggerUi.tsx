"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    SwaggerUIBundle?: (options: Record<string, unknown>) => void;
  }
}

export function SwaggerUi() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !window.SwaggerUIBundle) return;
    window.SwaggerUIBundle({
      url: "/api/docs/openapi",
      dom_id: "#swagger-ui",
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      operationsSorter: "alpha",
      tagsSorter: "alpha",
    });
  }, [ready]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <div id="swagger-ui" />
      <Script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" onLoad={() => setReady(true)} />
    </>
  );
}
