import type MatterNamespace from 'matter-js';

type Matter = typeof MatterNamespace;
type Body = MatterNamespace.Body;
type Constraint = MatterNamespace.Constraint;

type Chip = {
  id: string;
  el: HTMLElement;
  width: number;
  height: number;
  body: Body | null;
  kept: boolean;
  show: boolean;
  dropping: boolean;
  touchedAt: number;
  previous: { x: number; y: number; angle: number };
  lastTransform: string;
};

type Options = {
  Matter: Matter;
  stage: HTMLElement;
  folder: HTMLElement;
  ceiling: HTMLElement;
  chips: Array<{ id: string; el: HTMLElement }>;
  initialKept: Set<string>;
  reduced: boolean;
  leavingClass: string;
  draggingClass: string;
  onCollected: (id: string) => void;
  onFolderHot: (hot: boolean) => void;
};

const WALL = 1;
const CHIP = 2;
const FOLDER = 4;
const SOLID = WALL | CHIP | FOLDER;
const STEP = 1000 / 60;
const MAX_FRAME_MS = 100;
const PILE_FILL_RATIO = 0.55;

// Chips drift toward a shallow lean while moving, so stacks stay readable without snapping.
const SOFT_TILT = 0.2;
const HARD_TILT = 0.58;
const LEVEL_RATE = 0.014;
const MAX_SPEED = 30;
const MAX_SPIN = 0.2;

const REPEL_RADIUS = 80;
const REPEL_STRENGTH = 0.0024;
const REPEL_MIN_POINTER_SPEED = 0.12;
const REPEL_FULL_POINTER_SPEED = 1.4;
const REPEL_CONTACT_LEVER = 0.5;
const POINTER_IDLE_MS = 120;

const DRAG_STIFFNESS = 0.32;
const DRAG_DAMPING = 0.2;
// Near 1 means the grab point moves the chip without twisting it, even when held by one end.
const DRAG_ANGULAR_STIFFNESS = 0.92;
const DRAG_SPIN_DAMPING = 0.86;
const DRAG_SWING = 0.012;
const DRAG_MAX_SWING = 0.22;
const DRAG_LEVEL_RATE = 0.05;
const FOLDER_PULL = 0.22;
const THROW_MIN_SPEED = 0.5;
const THROW_MAX_RELEASE_AGE_MS = 90;
const THROW_LOOKAHEAD_MS = 280;
const THROW_SAMPLE_MS = 28;
const TOUCH_DRAG_THRESHOLD = 8;

const REACTION_STAGGER_MS = 18;
const DROP_MARGIN = { side: 14, top: 30, bottom: 14 };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Physics for the pile of quotes. React owns the content; this class owns only position and motion. */
export class ChipPile {
  private readonly matter: Matter;
  private readonly engine: MatterNamespace.Engine;
  private readonly world: MatterNamespace.World;
  private readonly chips: Chip[];
  private readonly byId = new Map<string, Chip>();
  private readonly listeners = new AbortController();
  private readonly timers = new Set<number>();
  private walls: Body[] = [];
  private folderBody: Body | null = null;
  private width = 0;
  private height = 0;
  private capacity = 0;
  private grab: { chip: Chip; link: Constraint; start: { x: number; y: number }; moved: boolean; lastX: number; lastY: number; lastAt: number; velocityX: number; velocityY: number } | null = null;
  private pendingTouch: { chip: Chip; x: number; y: number } | null = null;
  private pointer: { x: number; y: number; at: number; speed: number } | null = null;
  private lastTarget: string[] | null = null;
  private lastKey: string | null = null;
  private spawnToken = 0;
  private frameId = 0;
  private accumulated = 0;
  private lastFrame = 0;
  private onScreen = true;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  constructor(private readonly options: Options) {
    this.matter = options.Matter;
    this.engine = this.matter.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 6, constraintIterations: 3 });
    this.engine.gravity.y = 1.15;
    this.world = this.engine.world;
    this.chips = options.chips.map(({ id, el }) => {
      const chip: Chip = { id, el, width: 0, height: 0, body: null, kept: options.initialKept.has(id), show: true, dropping: false, touchedAt: 0, previous: { x: 0, y: 0, angle: 0 }, lastTransform: '' };
      this.byId.set(id, chip);
      return chip;
    });
  }

  start() {
    const { stage, reduced } = this.options;
    for (const chip of this.chips) {
      chip.width = Math.ceil(chip.el.offsetWidth);
      chip.height = Math.ceil(chip.el.offsetHeight);
      chip.el.hidden = true;
      this.bindChip(chip);
    }
    this.placeWalls();

    const averageArea = this.chips.reduce((sum, chip) => sum + chip.width * chip.height, 0) / Math.max(1, this.chips.length);
    // Only the space below the input counts, so the resting pile never buries the controls.
    const reservedTop = this.options.ceiling.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
    const folderArea = this.options.folder.offsetWidth * this.options.folder.offsetHeight;
    const openArea = Math.max(0, this.width * (this.height - reservedTop) - folderArea);
    this.capacity = Math.max(5, Math.floor((openArea * PILE_FILL_RATIO) / Math.max(1, averageArea)));

    this.matter.Events.on(this.engine, 'beforeUpdate', () => this.beforeUpdate());

    const idle = this.idleChips();
    const target = new Set(idle);
    for (const chip of this.chips) chip.show = target.has(chip);
    let shelfX = 16;
    let shelfY = this.height - 30;
    idle.forEach((chip, index) => {
      if (!reduced) {
        this.spawn(chip, -60 - index * 26 - Math.random() * 30);
        return;
      }
      if (shelfX + chip.width > this.width - 16) {
        shelfX = 16;
        shelfY -= chip.height + 10;
      }
      this.spawn(chip, shelfY, shelfX + chip.width / 2);
      shelfX += chip.width + 12;
    });
    if (reduced) this.settle(500);
    this.lastKey = 'idle';

    stage.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const point = this.pointIn(event);
      const now = performance.now();
      const last = this.pointer;
      const elapsed = last ? Math.max(1, now - last.at) : 1;
      const speed = last ? Math.hypot(point.x - last.x, point.y - last.y) / elapsed : 0;
      this.pointer = { ...point, at: now, speed: last ? last.speed * 0.6 + speed * 0.4 : 0 };
    }, { signal: this.listeners.signal });

    let lastWidth = stage.clientWidth;
    let lastHeight = stage.clientHeight;
    this.resizeObserver = new ResizeObserver(() => {
      if (stage.clientWidth === lastWidth && Math.abs(stage.clientHeight - lastHeight) < 80) return;
      lastWidth = stage.clientWidth;
      lastHeight = stage.clientHeight;
      this.placeWalls();
      for (const chip of this.chips) {
        if (!chip.body) continue;
        this.matter.Sleeping.set(chip.body, false);
        if (chip.body.position.x > this.width - 20 || chip.body.position.y > this.height) {
          this.matter.Body.setPosition(chip.body, { x: Math.min(chip.body.position.x, this.width - chip.width), y: Math.min(chip.body.position.y, this.height - 80) });
        }
      }
    });
    this.resizeObserver.observe(stage);
    this.intersectionObserver = new IntersectionObserver(([entry]) => { this.onScreen = entry.isIntersecting; });
    this.intersectionObserver.observe(stage);

    this.lastFrame = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.frameId);
    this.listeners.abort();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    for (const timer of this.timers) clearTimeout(timer);
    this.matter.Engine.clear(this.engine);
  }

  /** Shows these quotes, or the resting pile when `ids` is null or empty. */
  apply(ids: string[] | null, bounce = true) {
    this.lastTarget = ids;
    const filtering = Boolean(ids?.length);
    const wanted = filtering ? ids!.flatMap((id) => this.byId.get(id) ?? []).filter((chip) => !chip.kept).slice(0, this.capacity) : this.idleChips();
    const hit = new Set(wanted);
    const key = filtering ? wanted.map((chip) => chip.id).join(',') : 'idle';
    if (key === this.lastKey) return;
    this.lastKey = key;

    const { Sleeping, Body } = this.matter;
    const { reduced, leavingClass } = this.options;
    const token = (this.spawnToken += 1);
    let queued = 0;
    let reacted = 0;
    for (const chip of this.chips) {
      if (chip.kept) continue;
      chip.show = hit.has(chip);
      if (chip.show && chip.body && chip.dropping) {
        chip.dropping = false;
        chip.body.collisionFilter.mask = SOLID;
        chip.el.classList.remove(leavingClass);
      }
      if (!chip.show && chip.body && !chip.dropping) {
        chip.dropping = true;
        chip.body.collisionFilter.mask = 0;
        Sleeping.set(chip.body, false);
        chip.el.classList.add(leavingClass);
        Body.setVelocity(chip.body, { x: (Math.random() - 0.5) * 3, y: 2 });
      }
      if (chip.show && !chip.body) {
        const delay = reduced ? 0 : queued * 55;
        queued += 1;
        const place = () => {
          if (token === this.spawnToken && chip.show && !chip.body && !chip.kept) this.spawn(chip, reduced ? this.height * 0.6 : -60);
        };
        if (delay) this.later(place, delay);
        else place();
      } else if (chip.show && chip.body) {
        Sleeping.set(chip.body, false);
        if (filtering && bounce && !reduced) {
          this.later(() => this.react(chip, token), reacted * REACTION_STAGGER_MS);
          reacted += 1;
        }
      }
    }
    if (reduced) this.settle(240);
  }

  collect(id: string) {
    const chip = this.byId.get(id);
    if (!chip || chip.kept) return;
    chip.kept = true;
    const { stage, folder, reduced, onCollected } = this.options;
    const folderRect = folder.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const targetX = folderRect.left - stageRect.left + folderRect.width / 2 - chip.width / 2;
    const targetY = folderRect.top - stageRect.top + 40 - chip.height / 2;
    const start = chip.body
      ? { x: chip.body.position.x - chip.width / 2, y: chip.body.position.y - chip.height / 2, angle: chip.body.angle }
      : { x: targetX, y: -60, angle: 0 };
    if (this.grab?.chip === chip) this.endGrab();
    if (chip.body) {
      const removedY = chip.body.position.y;
      this.matter.Composite.remove(this.world, chip.body);
      chip.body = null;
      // Only chips at or above the gap can lose support, so the rest of the pile stays still.
      for (const other of this.chips) {
        if (other.body && other.body.position.y < removedY + chip.height) this.matter.Sleeping.set(other.body, false);
      }
    }

    const finish = () => {
      chip.el.hidden = true;
      chip.el.style.zIndex = '';
      onCollected(chip.id);
      this.lastKey = null;
      this.apply(this.lastTarget, false);
    };
    if (reduced) {
      finish();
      return;
    }
    chip.el.style.zIndex = '8';
    const animation = chip.el.animate([
      { transform: `translate(${start.x}px,${start.y}px) rotate(${start.angle}rad) scale(1)`, opacity: 1 },
      { transform: `translate(${targetX}px,${targetY - 60}px) rotate(0rad) scale(.72)`, opacity: 1, offset: 0.72 },
      { transform: `translate(${targetX}px,${targetY + 40}px) rotate(0rad) scale(.3)`, opacity: 0 },
    ], { duration: 460, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
    animation.onfinish = () => {
      finish();
      animation.cancel();
    };
  }

  collectMany(ids: string[]) {
    ids.forEach((id, index) => {
      if (this.options.reduced) this.collect(id);
      else this.later(() => this.collect(id), index * 70);
    });
  }

  release(id: string) {
    const chip = this.byId.get(id);
    if (!chip || !chip.kept) return;
    chip.kept = false;
    this.lastKey = null;
    this.apply(this.lastTarget, false);
  }

  /** Matched chips hop in a quick wave and lean toward the middle, so the reaction reads as one gesture. */
  private react(chip: Chip, token: number) {
    const body = chip.body;
    if (token !== this.spawnToken || !body || !chip.show || this.grab?.chip === chip) return;
    const { Sleeping, Body } = this.matter;
    Sleeping.set(body, false);
    const pull = clamp((this.width / 2 - body.position.x) * 0.012, -5, 5);
    Body.setVelocity(body, { x: pull + (Math.random() - 0.5) * 2, y: -8 - Math.random() * 6 });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
  }

  private later(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
  }

  private idleChips() {
    return this.chips.filter((chip) => !chip.kept).slice(0, this.capacity);
  }

  private placeWalls() {
    const { Bodies, Composite } = this.matter;
    const { stage, folder } = this.options;
    this.width = stage.clientWidth;
    this.height = stage.clientHeight;
    if (this.walls.length) Composite.remove(this.world, this.walls);
    if (this.folderBody) Composite.remove(this.world, this.folderBody);
    const thickness = 240;
    const wallOptions = { isStatic: true, friction: 0.7, collisionFilter: { category: WALL, mask: -1 } };
    this.walls = [
      Bodies.rectangle(this.width / 2, this.height + thickness / 2, this.width + 2 * thickness, thickness, wallOptions),
      Bodies.rectangle(-thickness / 2, this.height / 2 - 2000, thickness, this.height + 5000, wallOptions),
      Bodies.rectangle(this.width + thickness / 2, this.height / 2 - 2000, thickness, this.height + 5000, wallOptions),
    ];
    const folderRect = folder.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    this.folderBody = Bodies.rectangle(
      folderRect.left - stageRect.left + folderRect.width / 2,
      folderRect.top - stageRect.top + folderRect.height / 2 - 6,
      folderRect.width + 8,
      folderRect.height + 20,
      { isStatic: true, chamfer: { radius: 18 }, friction: 0.6, collisionFilter: { category: FOLDER, mask: -1 } },
    );
    Composite.add(this.world, [...this.walls, this.folderBody]);
  }

  private spawn(chip: Chip, y: number, fixedX?: number) {
    const { Bodies, Composite } = this.matter;
    const padding = chip.width / 2 + 8;
    const x = fixedX ?? padding + Math.random() * Math.max(1, this.width - padding * 2);
    chip.body = Bodies.rectangle(x, y, chip.width, chip.height, {
      chamfer: { radius: chip.height / 2 - 1, quality: 5 },
      restitution: 0.18,
      friction: 0.6,
      frictionStatic: 0.8,
      frictionAir: 0.012,
      density: 0.0015,
      slop: 0.05,
      sleepThreshold: 45,
      angle: (Math.random() - 0.5) * 0.4,
      collisionFilter: { category: CHIP, mask: SOLID },
    });
    chip.previous = { x, y, angle: chip.body.angle };
    chip.lastTransform = '';
    chip.dropping = false;
    chip.el.classList.remove(this.options.leavingClass);
    chip.el.hidden = false;
    Composite.add(this.world, chip.body);
  }

  private pointIn(event: { clientX: number; clientY: number }) {
    const rect = this.options.stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private overFolder(event: { clientX: number; clientY: number }) {
    const rect = this.options.folder.getBoundingClientRect();
    return event.clientX > rect.left - DROP_MARGIN.side && event.clientX < rect.right + DROP_MARGIN.side
      && event.clientY > rect.top - DROP_MARGIN.top && event.clientY < rect.bottom + DROP_MARGIN.bottom;
  }

  private folderCenter() {
    const stageRect = this.options.stage.getBoundingClientRect();
    const rect = this.options.folder.getBoundingClientRect();
    return { x: rect.left - stageRect.left + rect.width / 2, y: rect.top - stageRect.top + rect.height / 2 };
  }

  /** True when the cursor was still moving at release, fast enough and straight enough to reach the folder. */
  private thrownIntoFolder(event: PointerEvent) {
    const grab = this.grab;
    if (!grab || performance.now() - grab.lastAt > THROW_MAX_RELEASE_AGE_MS) return false;
    if (Math.hypot(grab.velocityX, grab.velocityY) < THROW_MIN_SPEED) return false;
    // Sampling along the path catches a fast throw that would otherwise fly past the folder between checks.
    for (let time = THROW_SAMPLE_MS; time <= THROW_LOOKAHEAD_MS; time += THROW_SAMPLE_MS) {
      if (this.overFolder({ clientX: event.clientX + grab.velocityX * time, clientY: event.clientY + grab.velocityY * time })) return true;
    }
    return false;
  }

  private startGrab(chip: Chip, event: PointerEvent) {
    const body = chip.body;
    if (!body) return;
    const { Sleeping, Constraint, Composite } = this.matter;
    const point = this.pointIn(event);
    Sleeping.set(body, false);
    body.collisionFilter.mask = WALL | CHIP;
    const dx = point.x - body.position.x;
    const dy = point.y - body.position.y;
    const cos = Math.cos(-body.angle);
    const sin = Math.sin(-body.angle);
    const link = Constraint.create({ pointA: point, bodyB: body, pointB: { x: dx * cos - dy * sin, y: dx * sin + dy * cos }, stiffness: DRAG_STIFFNESS, damping: DRAG_DAMPING, length: 0, ...{ angularStiffness: DRAG_ANGULAR_STIFFNESS } });
    Composite.add(this.world, link);
    this.grab = { chip, link, start: point, moved: false, lastX: event.clientX, lastY: event.clientY, lastAt: performance.now(), velocityX: 0, velocityY: 0 };
    chip.el.classList.add(this.options.draggingClass);
    try {
      chip.el.setPointerCapture(event.pointerId);
    } catch {
      // The pointer can already be gone; the drag then simply ends on the next event.
    }
  }

  private endGrab() {
    if (!this.grab) return;
    const { chip, link } = this.grab;
    this.matter.Composite.remove(this.world, link);
    chip.el.classList.remove(this.options.draggingClass);
    this.options.onFolderHot(false);
    if (chip.body) chip.body.collisionFilter.mask = SOLID;
    this.grab = null;
  }

  private bindChip(chip: Chip) {
    const { signal } = this.listeners;
    const { onFolderHot } = this.options;

    chip.el.addEventListener('pointerdown', (event) => {
      if (!chip.body) return;
      if (event.pointerType === 'touch') {
        // Vertical swipes stay native scrolling, so a touch only becomes a drag once it moves sideways.
        this.pendingTouch = { chip, x: event.clientX, y: event.clientY };
        return;
      }
      event.preventDefault();
      chip.el.focus({ preventScroll: true });
      this.startGrab(chip, event);
    }, { signal });

    chip.el.addEventListener('pointermove', (event) => {
      if (this.pendingTouch?.chip === chip) {
        const dx = Math.abs(event.clientX - this.pendingTouch.x);
        const dy = Math.abs(event.clientY - this.pendingTouch.y);
        if (dx >= TOUCH_DRAG_THRESHOLD && dx > dy) {
          this.pendingTouch = null;
          this.startGrab(chip, event);
        } else if (dy >= TOUCH_DRAG_THRESHOLD) {
          this.pendingTouch = null;
        }
      }
      if (this.grab?.chip !== chip) return;
      const point = this.pointIn(event);
      const now = performance.now();
      const elapsed = Math.max(1, now - this.grab.lastAt);
      this.grab.velocityX = this.grab.velocityX * 0.5 + ((event.clientX - this.grab.lastX) / elapsed) * 0.5;
      this.grab.velocityY = this.grab.velocityY * 0.5 + ((event.clientY - this.grab.lastY) / elapsed) * 0.5;
      this.grab.lastX = event.clientX;
      this.grab.lastY = event.clientY;
      this.grab.lastAt = now;
      if (Math.hypot(point.x - this.grab.start.x, point.y - this.grab.start.y) > 6) this.grab.moved = true;
      const hot = this.overFolder(event);
      const center = this.folderCenter();
      this.grab.link.pointA = hot ? { x: point.x + (center.x - point.x) * FOLDER_PULL, y: point.y + (center.y - point.y) * FOLDER_PULL } : point;
      onFolderHot(hot);
    }, { signal });

    const release = (event: PointerEvent) => {
      if (this.pendingTouch?.chip === chip) this.pendingTouch = null;
      if (this.grab?.chip !== chip) return;
      const { moved } = this.grab;
      const thrown = this.thrownIntoFolder(event);
      this.endGrab();
      if (this.overFolder(event) || !moved || thrown) this.collect(chip.id);
    };
    chip.el.addEventListener('pointerup', release, { signal });
    chip.el.addEventListener('pointercancel', release, { signal });

    chip.el.addEventListener('touchend', () => { chip.touchedAt = performance.now(); }, { passive: true, signal });
    chip.el.addEventListener('click', (event) => {
      // Mouse clicks are already handled on pointerup. This path is for keyboards and taps.
      if (event.detail === 0 || performance.now() - chip.touchedAt < 400) this.collect(chip.id);
    }, { signal });
  }

  private beforeUpdate() {
    for (const chip of this.chips) {
      const body = chip.body;
      if (!body || body.isSleeping || chip.dropping) continue;
      this.limitMotion(body);
      if (this.grab?.chip === chip) this.steerDragged(body);
      else this.keepReadable(body);
    }
    this.repelFromPointer();
  }

  private limitMotion(body: Body) {
    const { Body: BodyApi } = this.matter;
    if (body.speed > MAX_SPEED) {
      const scale = MAX_SPEED / body.speed;
      BodyApi.setVelocity(body, { x: body.velocity.x * scale, y: body.velocity.y * scale });
    }
    if (Math.abs(body.angularVelocity) > MAX_SPIN) BodyApi.setAngularVelocity(body, Math.sign(body.angularVelocity) * MAX_SPIN);
  }

  /** Cancels gravity and pendulum swing, then tilts the held chip slightly into its direction of travel. */
  private steerDragged(body: Body) {
    const { Body: BodyApi } = this.matter;
    BodyApi.applyForce(body, body.position, { x: 0, y: -body.mass * this.engine.gravity.y * this.engine.gravity.scale });
    const lean = clamp(body.velocity.x * DRAG_SWING, -DRAG_MAX_SWING, DRAG_MAX_SWING);
    const angle = Math.atan2(Math.sin(body.angle), Math.cos(body.angle));
    BodyApi.setAngularVelocity(body, body.angularVelocity * DRAG_SPIN_DAMPING + (lean - angle) * DRAG_LEVEL_RATE);
  }

  /** Chips may lean but never lie vertically or upside down, so every quote stays readable. */
  private keepReadable(body: Body) {
    const { Body: BodyApi } = this.matter;
    if (Math.abs(body.angle) > Math.PI) BodyApi.setAngle(body, Math.atan2(Math.sin(body.angle), Math.cos(body.angle)));
    const direction = Math.sign(body.angle);
    const tilt = Math.abs(body.angle);
    // Leveling only while moving lets a settled pile fall asleep instead of trembling.
    if (tilt > SOFT_TILT && body.speed > 0.25) {
      BodyApi.setAngularVelocity(body, body.angularVelocity - direction * (tilt - SOFT_TILT) * LEVEL_RATE);
    }
    if (tilt > HARD_TILT) {
      if (body.angularVelocity * direction > 0) BodyApi.setAngularVelocity(body, 0);
      BodyApi.setAngle(body, direction * (HARD_TILT + (tilt - HARD_TILT) * 0.8));
    }
  }

  /** A moving cursor brushes nearby chips. A still cursor leaves them alone so they can rest and be grabbed. */
  private repelFromPointer() {
    const pointer = this.pointer;
    if (!pointer || this.grab || this.options.reduced) return;
    if (performance.now() - pointer.at > POINTER_IDLE_MS || pointer.speed < REPEL_MIN_POINTER_SPEED) return;
    const { Body: BodyApi, Sleeping } = this.matter;
    const influence = Math.min(1, pointer.speed / REPEL_FULL_POINTER_SPEED);
    for (const chip of this.chips) {
      const body = chip.body;
      if (!body || chip.dropping) continue;
      const cos = Math.cos(body.angle);
      const sin = Math.sin(body.angle);
      const worldX = pointer.x - body.position.x;
      const worldY = pointer.y - body.position.y;
      const localX = worldX * cos + worldY * sin;
      const localY = -worldX * sin + worldY * cos;
      const nearestX = clamp(localX, -chip.width / 2, chip.width / 2);
      const nearestY = clamp(localY, -chip.height / 2, chip.height / 2);
      const gapX = localX - nearestX;
      const gapY = localY - nearestY;
      const distance = Math.hypot(gapX, gapY);
      // The chip under the cursor stays put so it can be grabbed.
      if (distance === 0 || distance >= REPEL_RADIUS) continue;
      Sleeping.set(body, false);
      const strength = body.mass * REPEL_STRENGTH * influence * (1 - distance / REPEL_RADIUS);
      const pushX = (-(gapX * cos - gapY * sin) / distance) * strength;
      const pushY = (-(gapX * sin + gapY * cos) / distance) * strength - strength * 0.3;
      const contact = {
        x: body.position.x + (nearestX * cos - nearestY * sin) * REPEL_CONTACT_LEVER,
        y: body.position.y + (nearestX * sin + nearestY * cos) * REPEL_CONTACT_LEVER,
      };
      BodyApi.applyForce(body, contact, { x: pushX, y: pushY });
    }
  }

  private step() {
    for (const chip of this.chips) {
      if (chip.body) chip.previous = { x: chip.body.position.x, y: chip.body.position.y, angle: chip.body.angle };
    }
    this.matter.Engine.update(this.engine, STEP);
  }

  /** Draws between the last two physics steps, which keeps motion smooth on 120Hz displays. */
  private sync(alpha: number) {
    for (const chip of this.chips) {
      const body = chip.body;
      if (!body) continue;
      if (body.position.y > this.height + 140 && chip.dropping) {
        this.matter.Composite.remove(this.world, body);
        chip.body = null;
        chip.el.hidden = true;
        continue;
      }
      // The held chip is drawn at its newest position so it never lags behind the cursor.
      const blend = this.grab?.chip === chip ? 1 : alpha;
      const x = chip.previous.x + (body.position.x - chip.previous.x) * blend;
      const y = chip.previous.y + (body.position.y - chip.previous.y) * blend;
      const angle = chip.previous.angle + (body.angle - chip.previous.angle) * blend;
      const transform = `translate(${(x - chip.width / 2).toFixed(2)}px,${(y - chip.height / 2).toFixed(2)}px) rotate(${angle.toFixed(4)}rad)`;
      if (transform !== chip.lastTransform) {
        chip.el.style.transform = transform;
        chip.lastTransform = transform;
      }
    }
  }

  private settle(steps: number) {
    for (let i = 0; i < steps; i += 1) this.step();
    this.sync(1);
  }

  private readonly frame = (now: number) => {
    this.accumulated += Math.min(MAX_FRAME_MS, now - this.lastFrame);
    this.lastFrame = now;
    if (this.onScreen) {
      while (this.accumulated >= STEP) {
        this.step();
        this.accumulated -= STEP;
      }
      this.sync(this.accumulated / STEP);
    } else {
      this.accumulated = 0;
    }
    this.frameId = requestAnimationFrame(this.frame);
  };
}
