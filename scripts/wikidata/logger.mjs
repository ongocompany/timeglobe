function ts() {
  return new Date().toISOString();
}

export function logInfo(message, meta) {
  if (meta) {
    console.log(`[${ts()}] INFO ${message}`, meta);
    return;
  }
  console.log(`[${ts()}] INFO ${message}`);
}

export function logWarn(message, meta) {
  if (meta) {
    console.warn(`[${ts()}] WARN ${message}`, meta);
    return;
  }
  console.warn(`[${ts()}] WARN ${message}`);
}

export function logError(message, meta) {
  if (meta) {
    console.error(`[${ts()}] ERROR ${message}`, meta);
    return;
  }
  console.error(`[${ts()}] ERROR ${message}`);
}
