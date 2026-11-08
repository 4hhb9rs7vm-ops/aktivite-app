// Açılır pencere trafiği: iPhone aynı anda iki Modal gösteremez; ikincisi görünmez kalıp ekranı kilitler.
// Ekranı kaplayan pencereler (Günün Sorusu, paylaş ipucu, rozet kutlaması) açıkken burada işaretlenir,
// diğerleri boşalmasını bekler.
const busy = new Set<string>();
const freeListeners = new Set<() => void>();

export function setOverlayBusy(name: string, on: boolean): void {
  if (on) busy.add(name);
  else busy.delete(name);
  if (busy.size === 0) {
    freeListeners.forEach((f) => {
      try {
        f();
      } catch {}
    });
  }
}

// Kendisi dışında açık pencere var mı?
export function isOverlayBusy(except?: string): boolean {
  for (const n of busy) if (n !== except) return true;
  return false;
}

// Bütün pencereler kapanınca bir kez haber ver (zaten boşsa hemen)
export function whenOverlayFree(cb: () => void, except?: string): () => void {
  if (!isOverlayBusy(except)) {
    cb();
    return () => {};
  }
  let done = false;
  const f = () => {
    if (done || isOverlayBusy(except)) return;
    done = true;
    freeListeners.delete(f);
    cb();
  };
  freeListeners.add(f);
  return () => {
    done = true;
    freeListeners.delete(f);
  };
}
