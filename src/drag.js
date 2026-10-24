// 以 Pointer Events 實作的拖曳；沒有超過門檻的移動視為「點一下」。
const THRESHOLD = 6;

/**
 * @param {HTMLElement} el
 * @param {object} o
 *  canDrag()      是否允許拖曳（預設 true）；不允許時只會觸發 onTap
 *  keepSource     拖曳時來源元素保持原樣（用於可重複使用的來源方塊）
 *  onStart()      開始拖曳
 *  onMove(x, y)   拖曳中，x/y 為落點座標
 *  onDrop(x, y)   放開
 *  onCancel()     被系統中斷
 *  onTap()        點一下
 */
export function attachDrag(el, o) {
  el.addEventListener('dragstart', (e) => e.preventDefault());
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const pid = e.pointerId;
    const sx = e.clientX;
    const sy = e.clientY;
    const allowDrag = !o.canDrag || o.canDrag();
    // 手指會擋住方塊，所以觸控時讓拖曳中的方塊浮在手指上方
    const lift = e.pointerType === 'touch' ? 36 : 0;
    let dragging = false;
    let ghost = null;
    let w = 0;
    let h = 0;
    let px = sx;
    let py = sy;

    const place = (cx, cy) => {
      px = cx;
      py = cy - lift;
      ghost.style.transform = `translate(${px - w / 2}px, ${py - h / 2}px) scale(1.08)`;
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (ghost) ghost.remove();
      if (dragging && !o.keepSource) el.classList.remove('dragging');
    };

    function move(ev) {
      if (ev.pointerId !== pid) return;
      if (!dragging) {
        if (!allowDrag) return;
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESHOLD) return;
        dragging = true;
        const r = el.getBoundingClientRect();
        w = r.width;
        h = r.height;
        ghost = el.cloneNode(true);
        ghost.classList.add('ghost');
        ghost.classList.remove('selected', 'over', 'wrong');
        ghost.style.width = `${w}px`;
        ghost.style.height = `${h}px`;
        document.body.appendChild(ghost);
        if (!o.keepSource) el.classList.add('dragging');
        if (o.onStart) o.onStart();
      }
      ev.preventDefault();
      place(ev.clientX, ev.clientY);
      if (o.onMove) o.onMove(px, py);
    }

    function up(ev) {
      if (ev.pointerId !== pid) return;
      const wasDragging = dragging;
      const moved = Math.hypot(ev.clientX - sx, ev.clientY - sy);
      cleanup();
      if (wasDragging) {
        if (o.onDrop) o.onDrop(px, py);
      } else if (moved < THRESHOLD * 2 && o.onTap) {
        o.onTap();
      }
    }

    function cancel(ev) {
      if (ev.pointerId !== pid) return;
      const wasDragging = dragging;
      cleanup();
      if (wasDragging && o.onCancel) o.onCancel();
    }

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });
}

/** 座標下方（含容許誤差）最近的 [data-slot] 空格，找不到回傳 null */
export function slotAt(x, y, pad = 12) {
  let best = null;
  let bestDist = Infinity;
  document.querySelectorAll('[data-slot]').forEach((s) => {
    const r = s.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = Math.hypot(dx, dy);
    if (d <= pad && d < bestDist) {
      best = s;
      bestDist = d;
    }
  });
  return best;
}

/** 座標下方的 [data-drop] 區域名稱 */
export function zoneAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const z = el && el.closest('[data-drop]');
  return z ? z.dataset.drop : null;
}
