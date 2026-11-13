import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LIMITS,
  blockError,
  displayValue,
  done,
  formatResponseDelay,
  isEmpty,
  isVisible,
  recapStep,
  steps,
  welcome,
  type Answers,
  type Block,
  type PublicConfig,
  type Step,
} from '@cree/shared';
import { ApiFail, getConfig, presign, sendSubmission, uploadToStorage } from './api';
import { BlockView, type FileItem, type Loc } from './Blocks';
import { clearDraft, loadDraft, saveDraft } from './draft';
import { Privacy } from './Privacy';
import { Turnstile } from './Turnstile';

const RC = steps.length; // dernière étape de saisie : elle porte le récapitulatif
const DONE = RC + 1;
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

interface Section {
  id: string;
  title: string;
  sub: string;
  blocks: Block[];
}
const sectionsOf = (si: number, s: Step): Section[] =>
  s.sections.map((x, j) => ({ id: `${si}-${j}`, title: x.title, sub: x.sub, blocks: x.blocks }));

interface TitleProps {
  text: string;
  words: Array<{ t: string; anim: string }>;
  caret: string;
  size: string;
  margin?: string;
}
/** Titre animé mot par mot ; lu en entier par les lecteurs d'écran grâce à aria-label. */
function Title({ text, words, caret, size, margin }: TitleProps) {
  return (
    <h1
      id="cr-title"
      tabIndex={-1}
      aria-label={text}
      style={{
        margin: margin ?? 0,
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: '-.045em',
        textWrap: 'balance',
      }}
    >
      {words.map((w, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ display: 'inline-block', whiteSpace: 'pre', animation: w.anim }}
        >
          {w.t}
        </span>
      ))}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '.06em',
          minWidth: 2,
          height: '.85em',
          marginLeft: '.04em',
          verticalAlign: '-.06em',
          borderRadius: 2,
          background: '#7B52F0',
          animation: caret,
        }}
      />
    </h1>
  );
}

export function App() {
  if (location.pathname.replace(/\/$/, '') === '/confidentialite') return <Privacy />;
  return <Form />;
}

function Form() {
  const draft = useMemo(() => loadDraft(), []);
  const [step, setStep] = useState(Math.min(draft?.step ?? 0, RC));
  const [maxStep, setMaxStep] = useState(Math.max(draft?.step ?? 0, draft?.maxStep ?? 0));
  const [dir, setDir] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const [data, setData] = useState<Record<string, unknown>>(draft?.data ?? {});
  const [locs, setLocs] = useState<Loc[]>(
    draft?.locs?.length ? draft.locs.map((l) => ({ ...l, open: true })) : [{ id: 1, v: '', open: true }],
  );
  const [files, setFiles] = useState<FileItem[]>(
    (draft?.files ?? []).map((f) => ({
      key: f.id,
      name: f.name,
      size: f.size,
      progress: 1,
      status: 'done',
      id: f.id,
    })),
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [shake, setShake] = useState('');
  const [sending, setSending] = useState(false);
  const [sendOk, setSendOk] = useState(false);
  const [failed, setFailed] = useState('');
  const [consent, setConsent] = useState(false);
  const [consentErr, setConsentErr] = useState(false);
  const [token, setToken] = useState('');
  const [tokenErr, setTokenErr] = useState('');
  const [tsReset, setTsReset] = useState(0);
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [cfgFail, setCfgFail] = useState(false);
  const [firstName, setFirstName] = useState('');
  const idemKey = useRef(draft?.idempotencyKey ?? crypto.randomUUID());
  const uid = useRef(Math.max(1, ...(draft?.locs ?? []).map((l) => l.id)) + 1);
  const hp = useRef('');
  const rawFiles = useRef(new Map<string, File>());
  const glow = useRef<HTMLDivElement>(null);
  const rm = useRef(reduced());

  const loadConfig = useCallback(() => {
    setCfgFail(false);
    getConfig()
      .then(setCfg)
      .catch(() => setCfgFail(true));
  }, []);
  useEffect(loadConfig, [loadConfig]);

  // Halo qui suit le pointeur ou l'inclinaison de l'appareil
  useEffect(() => {
    if (rm.current) return;
    const t = { x: 0, y: 0 };
    const c = { x: 0, y: 0 };
    const mv = (e: PointerEvent) => {
      t.x = e.clientX / innerWidth - 0.5;
      t.y = e.clientY / innerHeight - 0.5;
    };
    const or = (e: DeviceOrientationEvent) => {
      if (e.gamma != null && e.beta != null) {
        t.x = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
        t.y = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90));
      }
    };
    addEventListener('pointermove', mv);
    addEventListener('deviceorientation', or);
    let raf = 0;
    const loop = () => {
      c.x += (t.x - c.x) * 0.04;
      c.y += (t.y - c.y) * 0.04;
      if (glow.current) glow.current.style.transform = `translate3d(${c.x * 160}px,${c.y * 160}px,0)`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', mv);
      removeEventListener('deviceorientation', or);
    };
  }, []);

  // Brouillon local, enregistré à chaque modification
  useEffect(() => {
    if (sendOk) return;
    saveDraft({
      step: Math.min(step, RC),
      maxStep,
      data,
      locs: locs.map((l) => ({ id: l.id, v: l.v })),
      files: files
        .filter((f) => f.status === 'done' && f.id)
        .map((f) => ({ id: f.id!, name: f.name, size: f.size })),
      idempotencyKey: idemKey.current,
    });
  }, [step, maxStep, data, locs, files, sendOk]);

  // ---- valeurs et validation ----
  const rawValue = (b: Block): unknown => {
    if (b.kind === 'locations') return locs.map((l) => l.v.trim()).filter(Boolean);
    if (b.kind === 'file') return files.filter((f) => f.status === 'done' && f.id).map((f) => f.id!);
    const v = data[b.id];
    return typeof v === 'string' ? v.trim() : v;
  };
  const msg = (b: Block): string => {
    if (b.kind === 'file') {
      if (files.some((f) => f.status === 'uploading'))
        return 'Patientez : un fichier est encore en cours d’envoi.';
      if (files.some((f) => f.status === 'error'))
        return 'Un fichier n’a pas pu être envoyé. Réessayez ou retirez-le.';
    }
    return blockError(b, rawValue(b));
  };
  const visible = (s: Step): Block[] => s.sections.flatMap((x) => x.blocks).filter((b) => isVisible(b, data));
  const firstBad = (s: Step) => visible(s).find((b) => msg(b));
  const filled = (b: Block) => !isEmpty(rawValue(b));

  const set = (id: string, v: unknown) => setData((d) => ({ ...d, [id]: v }));
  const touch = (id: string) => setTouched((t) => (t[id] ? t : { ...t, [id]: true }));

  // ---- navigation ----
  const focusTitle = () => {
    const fine = matchMedia('(pointer:fine)').matches;
    const first = fine
      ? document.querySelector<HTMLElement>(
          'main input[type=text],main input[type=email],main input[type=tel],main textarea',
        )
      : null;
    (first ?? document.getElementById('cr-title'))?.focus({ preventScroll: true });
  };
  const go = (n: number, after?: () => void) => {
    if (leaving) return;
    setDir(n > step ? 1 : -1);
    setLeaving(true);
    window.setTimeout(
      () => {
        setStep(n);
        setLeaving(false);
        setShake('');
        setMaxStep((m) => Math.max(m, Math.min(n, RC)));
        window.scrollTo(0, 0);
        window.setTimeout(() => {
          focusTitle();
          after?.();
        }, 80);
      },
      rm.current ? 10 : 220,
    );
  };
  const jump = (id: string) => {
    const el = document.getElementById(`s-${id}`);
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + scrollY - 90,
        behavior: rm.current ? 'auto' : 'smooth',
      });
  };
  const complain = (b: Block) => {
    const t: Record<string, boolean> = {};
    visible(steps[step - 1]!).forEach((x) => {
      t[x.id] = true;
    });
    setTouched((p) => ({ ...p, ...t }));
    setShake(b.id);
    window.setTimeout(() => setShake(''), 650);
    const el = document.getElementById(`f-${b.id}`) ?? document.getElementById(`o-${b.id}-0`);
    if (el) {
      window.scrollTo({
        top: Math.max(0, el.getBoundingClientRect().top + scrollY - 160),
        behavior: rm.current ? 'auto' : 'smooth',
      });
      window.setTimeout(() => el.focus({ preventScroll: true }), 120);
    }
  };
  const next = () => {
    if (leaving || sending) return;
    if (step === 0) return go(1);
    const bad = firstBad(steps[step - 1]!);
    if (bad) return complain(bad);
    if (step === RC) return void submit();
    go(step + 1);
  };
  const prev = () => step > 0 && go(step - 1);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const t = e.target as HTMLInputElement;
    if (['TEXTAREA', 'BUTTON', 'A'].includes(t.tagName) || t.type === 'file') return;
    e.preventDefault();
    next();
  };

  // ---- lieux ----
  const addLoc = () => {
    if (locs.length >= LIMITS.locations) return;
    const id = uid.current++;
    setLocs((l) => [...l, { id, v: '', open: false }]);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setLocs((l) => l.map((x) => (x.id === id ? { ...x, open: true } : x)));
        window.setTimeout(() => document.getElementById(`loc-${id}`)?.focus({ preventScroll: true }), 200);
      }),
    );
  };
  const rmLoc = (id: number) => {
    if (locs.length < 2) return;
    setLocs((l) => l.map((x) => (x.id === id ? { ...x, open: false } : x)));
    window.setTimeout(() => setLocs((l) => l.filter((x) => x.id !== id)), rm.current ? 10 : 400);
  };

  // ---- fichiers : envoi réel vers le stockage ----
  const patchFile = (key: string, p: Partial<FileItem>) =>
    setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)));
  const startUpload = async (key: string) => {
    const file = rawFiles.current.get(key);
    if (!file) return;
    patchFile(key, { status: 'uploading', progress: 0, error: undefined });
    try {
      const ps = await presign({ filename: file.name, contentType: file.type, size: file.size });
      await uploadToStorage(ps.url, ps.fields, file, (r) => patchFile(key, { progress: r }));
      patchFile(key, { status: 'done', progress: 1, id: ps.attachmentId });
    } catch (e) {
      patchFile(key, {
        status: 'error',
        error: e instanceof ApiFail ? e.message : 'Ce fichier n’a pas pu être envoyé. Réessayez.',
      });
    }
  };
  const addFiles = (list: FileList) => {
    const room = LIMITS.files - files.length;
    const added: FileItem[] = [];
    Array.from(list).forEach((file, i) => {
      const key = crypto.randomUUID();
      let error: string | undefined;
      if (i >= room) error = `Vous pouvez joindre ${LIMITS.files} fichiers au maximum.`;
      else if (!(LIMITS.fileTypes as readonly string[]).includes(file.type))
        error = 'Format non pris en charge (images, PDF ou vidéos MP4).';
      else if (file.size > LIMITS.fileBytes)
        error = `Ce fichier dépasse ${LIMITS.fileBytes / 1024 / 1024} Mo.`;
      rawFiles.current.set(key, file);
      added.push({
        key,
        name: file.name,
        size: file.size,
        progress: 0,
        status: error ? 'error' : 'uploading',
        error,
      });
    });
    setFiles((fs) => [...fs, ...added]);
    added.filter((a) => a.status === 'uploading').forEach((a) => void startUpload(a.key));
  };

  // ---- envoi ----
  const buildAnswers = (): Answers => {
    const out: Answers = {};
    for (const s of steps) {
      for (const b of visible(s)) {
        if (b.kind === 'range') out[b.id] = typeof data[b.id] === 'number' ? data[b.id] : b.def;
        else if (b.kind === 'scale') out[b.id] = typeof data[b.id] === 'number' ? data[b.id] : b.def;
        else if (filled(b)) out[b.id] = rawValue(b);
      }
    }
    return out;
  };
  const submit = async () => {
    for (let i = 0; i < steps.length; i++) {
      const bad = firstBad(steps[i]!);
      if (bad) {
        setTouched((t) => ({ ...t, [bad.id]: true }));
        if (i + 1 !== step) go(i + 1);
        else complain(bad);
        return;
      }
    }
    if (!consent) {
      setConsentErr(true);
      document.getElementById('consent')?.focus();
      return;
    }
    if (!cfg) {
      loadConfig();
      setFailed('Le formulaire n’a pas pu être préparé. Vérifiez votre connexion, puis réessayez.');
      return;
    }
    if (!token) {
      setTokenErr('Validez la vérification anti-robot ci-dessus, puis envoyez de nouveau.');
      return;
    }
    setSending(true);
    setFailed('');
    const answers = buildAnswers();
    const payload = {
      idempotencyKey: idemKey.current,
      answers,
      consent: true,
      turnstileToken: token,
      site_web: hp.current,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      page: location.pathname,
    };
    try {
      await sendSubmission(payload);
      setFirstName(
        String(answers.nom ?? '')
          .trim()
          .split(/\s+/)[0] ?? '',
      );
      setSendOk(true);
      setSending(false);
      clearDraft();
      try {
        localStorage.removeItem('cree:secours');
      } catch {
        /* sans effet */
      }
      window.setTimeout(() => go(DONE), 800);
    } catch (e) {
      setSending(false);
      setToken('');
      setTsReset((n) => n + 1);
      const err = e instanceof ApiFail ? e : null;
      if (err?.status === 422 && err.fields) {
        const ids = Object.keys(err.fields);
        const idx = steps.findIndex((s) => s.sections.some((x) => x.blocks.some((b) => ids.includes(b.id))));
        setTouched((t) => ({ ...t, ...Object.fromEntries(ids.map((i) => [i, true])) }));
        setFailed(err.message);
        if (idx >= 0 && idx + 1 !== step) go(idx + 1);
      } else if (err?.code === 'antirobot') setFailed(err.message);
      else {
        // Coupure réseau ou erreur serveur : copie de secours locale, nouvel essai manuel.
        try {
          localStorage.setItem('cree:secours', JSON.stringify(payload));
        } catch {
          /* stockage plein */
        }
        setFailed(
          'Votre message n’a pas pu être envoyé. Vos réponses sont conservées sur cet appareil. Vérifiez votre connexion, puis réessayez.',
        );
      }
    }
  };

  // ---- rendu ----
  const par = step % 2;
  const an = (i: number) =>
    `${dir > 0 ? 'crInR' : 'crInL'}${par} 560ms cubic-bezier(.2,.7,.2,1) ${i * 40}ms both`;
  const cur = step >= 1 && step <= RC ? steps[step - 1]! : null;
  const secs = cur ? sectionsOf(step - 1, cur) : [];
  const vis = cur ? new Set(visible(cur).map((b) => b.id)) : new Set<string>();
  const titleText =
    step === 0
      ? welcome.title
      : step === DONE
        ? firstName
          ? `Merci, ${firstName}.`
          : 'Merci.'
        : (cur?.title ?? '');
  const words = titleText.split(' ').map((w, i, a) => ({
    t: i < a.length - 1 ? `${w} ` : w,
    anim: `crWord${par} 720ms cubic-bezier(.2,.7,.2,1) ${80 + i * 55}ms both`,
  }));
  const caret = `crCaret${par} .9s steps(1) ${words.length * 55 + 200}ms 4 both`;
  const counter = `Étape ${step} sur ${RC}`;
  const fillOf = (s: Step) => {
    const vb = visible(s);
    return vb.length ? vb.filter(filled).length / vb.length : 0;
  };
  const sectionOk = (blocks: Block[]) => {
    const vb = blocks.filter((b) => vis.has(b.id));
    return vb.every((b) => !msg(b)) && vb.some(filled);
  };
  const fileNames = new Map(files.filter((f) => f.id).map((f) => [f.id!, f.name] as const));
  const shown = buildAnswers();
  const recap = steps.flatMap((s, si) =>
    sectionsOf(si, s).map((sec) => ({
      title: sec.title,
      edit: () => go(si + 1, () => jump(sec.id)),
      rows: sec.blocks
        .filter((b) => isVisible(b, data))
        .map((b) => ({ k: b.label, v: displayValue(b, shown, fileNames) || '—' })),
    })),
  );
  const first = String(data.nom ?? '')
    .trim()
    .split(/\s+/)[0];
  void first;
  const nextLabel =
    step === 0 ? 'Commencer' : step === RC ? (failed ? 'Réessayer' : 'Envoyer ma demande') : 'Continuer';
  const uploading = files.some((f) => f.status === 'uploading');

  const blockProps = (b: Block, i: number) => {
    const m = msg(b);
    return {
      block: b,
      value: b.kind === 'locations' || b.kind === 'file' ? undefined : data[b.id],
      error: m,
      showError: !!touched[b.id] && !!m,
      shake: shake === b.id,
      anim: an(Math.min(i, 6) + 2),
      locs,
      files,
      onSet: set,
      onTouch: touch,
      onLocChange: (id: number, v: string) => setLocs((l) => l.map((x) => (x.id === id ? { ...x, v } : x))),
      onLocAdd: addLoc,
      onLocRemove: rmLoc,
      onFiles: addFiles,
      onFileRemove: (key: string) => {
        rawFiles.current.delete(key);
        setFiles((fs) => fs.filter((f) => f.key !== key));
      },
      onFileRetry: (key: string) => void startUpload(key),
    };
  };

  let gi = 0;

  return (
    <div
      onKeyDown={onKey}
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: '#F5F2FC',
        color: '#15112A',
        fontFamily: "'Geist Variable', system-ui, sans-serif",
        overflowX: 'clip',
      }}
    >
      <div
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(55% 45% at 100% 0%,rgba(196,170,255,.45),transparent 70%),radial-gradient(50% 45% at 0% 100%,rgba(255,196,236,.4),transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '-15%',
            right: '-15%',
            bottom: '-30%',
            height: '55%',
            background:
              'radial-gradient(40% 60% at 30% 50%,rgba(176,140,255,.3),transparent 70%),radial-gradient(35% 55% at 75% 60%,rgba(240,170,240,.26),transparent 70%)',
            filter: 'blur(40px)',
            animation: 'crDrift 26s ease-in-out infinite alternate',
          }}
        />
        <div
          ref={glow}
          style={{
            position: 'absolute',
            left: '15%',
            top: '-20%',
            width: '70vmax',
            height: '70vmax',
            background: 'radial-gradient(closest-side,rgba(160,130,255,.16),transparent)',
            willChange: 'transform',
          }}
        />
      </div>
      <input
        type="text"
        name="site_web"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        onChange={(e) => {
          hp.current = e.target.value;
        }}
        style={{ position: 'absolute', left: -9999, top: 0, width: 1, height: 1, opacity: 0, fontSize: 16 }}
      />
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 6,
          background: 'rgba(245,242,252,.8)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(123,82,240,.12)',
        }}
      >
        <div
          style={{
            width: 'min(100%,1120px)',
            margin: '0 auto',
            boxSizing: 'border-box',
            padding: '0 clamp(16px,4vw,32px)',
            minHeight: 68,
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(16px,4vw,48px)',
          }}
        >
          <span
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              font: "500 18px/1 'Geist Variable',sans-serif",
              letterSpacing: '-.03em',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: 'conic-gradient(#6A3DE8,#D98BFF,#6A3DE8)',
              }}
            />
            Crée
          </span>
          {cur && (
            <ol
              aria-label="Étapes"
              style={{
                flex: 1,
                maxWidth: 620,
                margin: '0 0 0 auto',
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                gap: 'clamp(8px,2vw,20px)',
              }}
            >
              {steps.map((s, k) => {
                const i = k + 1;
                const isCur = i === step;
                const fill = i < step ? 1 : isCur ? Math.max(0.06, fillOf(s)) : 0;
                return (
                  <li key={s.group} style={{ flex: isCur ? 1.6 : 1, minWidth: 0 }}>
                    <button
                      type="button"
                      className={`cr-st ${i < step ? 'dn' : ''}`}
                      aria-current={isCur ? 'step' : undefined}
                      disabled={i > maxStep}
                      onClick={() => go(i)}
                    >
                      <span className="n">{i}</span>
                      <span className="l">{s.group}</span>
                      <b>
                        <i style={{ transform: `scaleX(${fill})` }} />
                      </b>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </header>

      <main
        style={{
          position: 'relative',
          width: 'min(100%,1120px)',
          margin: '0 auto',
          boxSizing: 'border-box',
          padding: 'clamp(28px,5vw,56px) clamp(16px,4vw,32px) 150px',
        }}
      >
        <div
          key={step}
          style={{ animation: leaving ? `${dir > 0 ? 'crOutL' : 'crOutR'} 220ms ease-in both` : 'none' }}
        >
          {step === 0 && (
            <div style={{ maxWidth: 720, margin: 'clamp(0px,4vh,48px) auto 0', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40, animation: an(0) }}>
                <div style={{ position: 'relative', animation: 'crFloat 7s ease-in-out infinite' }}>
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: '-45%',
                      borderRadius: '50%',
                      background: 'radial-gradient(closest-side,rgba(140,90,255,.28),transparent)',
                    }}
                  />
                  <div className="cr-orb" style={{ ['--s' as string]: 'clamp(96px,22vw,140px)' }} />
                </div>
              </div>
              <p className="cr-lb" style={{ margin: '0 0 20px', animation: an(1) }}>
                Invitation sur mesure
              </p>
              <Title
                text={titleText}
                words={words}
                caret={caret}
                size="clamp(2.6rem,8.5vw,4.8rem)"
                margin="0 auto"
              />
              <p
                style={{
                  margin: '24px auto 0',
                  maxWidth: '30em',
                  fontSize: 'clamp(17px,2.2vw,19px)',
                  lineHeight: 1.6,
                  color: '#625C78',
                  textWrap: 'pretty',
                  animation: an(2),
                }}
              >
                {welcome.promise}
              </p>
              <ol
                style={{
                  margin: '40px auto 0',
                  padding: 8,
                  listStyle: 'none',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                  gap: 8,
                  textAlign: 'left',
                  background: 'rgba(255,255,255,.7)',
                  border: '1px solid rgba(123,82,240,.14)',
                  borderRadius: 20,
                  animation: an(3),
                }}
              >
                {steps.map((s, k) => (
                  <li
                    key={s.group}
                    style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14 }}
                  >
                    <span
                      style={{
                        flex: 'none',
                        display: 'grid',
                        placeItems: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'rgba(123,82,240,.1)',
                        color: '#5A36D6',
                        font: "500 12px/1 'Geist Mono Variable',monospace",
                      }}
                    >
                      {k + 1}
                    </span>
                    <span style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 500 }}>{s.group}</span>
                      <span style={{ fontSize: 14, color: '#625C78', lineHeight: 1.4 }}>{s.desc}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p style={{ margin: '20px 0 0', fontSize: 14, color: '#625C78', animation: an(4) }}>
                {welcome.duration} · {welcome.note}
              </p>
            </div>
          )}

          {cur && (
            <div className="cr-lay">
              <aside className="cr-aside" aria-label="Sections de l'étape">
                <p className="cr-lb" style={{ margin: '0 0 14px 12px' }}>
                  {counter}
                </p>
                <nav style={{ display: 'grid', gap: 2 }}>
                  {secs.map((sec, j) => (
                    <button
                      key={sec.id}
                      type="button"
                      className={`cr-ax ${sectionOk(sec.blocks) ? 'ok' : ''}`}
                      onClick={() => jump(sec.id)}
                    >
                      <span className="m">{String(j + 1).padStart(2, '0')}</span>
                      <span>{sec.title}</span>
                      <span className="d" />
                    </button>
                  ))}
                </nav>
              </aside>
              <div style={{ minWidth: 0 }}>
                <div style={{ maxWidth: 640, marginBottom: 'clamp(28px,4vw,40px)' }}>
                  <p className="cr-lb" style={{ margin: '0 0 14px', animation: an(0) }}>
                    {counter}
                  </p>
                  <Title text={titleText} words={words} caret={caret} size="clamp(2.1rem,5.6vw,3.4rem)" />
                  <p
                    style={{
                      margin: '14px 0 0',
                      fontSize: 17,
                      lineHeight: 1.5,
                      color: '#625C78',
                      animation: an(1),
                    }}
                  >
                    {cur.sub}
                  </p>
                </div>
                <div style={{ display: 'grid', gap: 20 }}>
                  {secs.map((sec, j) => (
                    <section
                      key={sec.id}
                      id={`s-${sec.id}`}
                      aria-labelledby={`h-${sec.id}`}
                      style={{
                        scrollMarginTop: 96,
                        background: 'rgba(255,255,255,.86)',
                        border: '1px solid rgba(123,82,240,.12)',
                        borderRadius: 24,
                        padding: 'clamp(20px,4vw,36px)',
                        boxShadow: '0 24px 60px -44px rgba(80,40,180,.45)',
                        animation: an(j + 2),
                      }}
                    >
                      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBottom: 26 }}>
                        <span
                          style={{ font: "500 13px/1 'Geist Mono Variable',monospace", color: '#5A36D6' }}
                        >
                          {String(j + 1).padStart(2, '0')}
                        </span>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <h2
                            id={`h-${sec.id}`}
                            style={{
                              margin: 0,
                              fontSize: 22,
                              fontWeight: 500,
                              letterSpacing: '-.02em',
                              lineHeight: 1.2,
                            }}
                          >
                            {sec.title}
                          </h2>
                          <p style={{ margin: 0, fontSize: 15, color: '#625C78', lineHeight: 1.45 }}>
                            {sec.sub}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 28 }}>
                        {sec.blocks
                          .filter((b) => vis.has(b.id))
                          .map((b) => (
                            <BlockView key={b.id} {...blockProps(b, gi++)} />
                          ))}
                      </div>
                    </section>
                  ))}

                  {step === RC && (
                    <section
                      aria-labelledby="h-recap"
                      style={{
                        background: 'rgba(255,255,255,.6)',
                        border: '1px dashed rgba(123,82,240,.35)',
                        borderRadius: 24,
                        padding: 'clamp(20px,4vw,36px)',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
                        <h2
                          id="h-recap"
                          style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-.02em' }}
                        >
                          Avant l'envoi
                        </h2>
                        <p style={{ margin: 0, fontSize: 15, color: '#625C78' }}>
                          {recapStep.sub} Tout reste modifiable.
                        </p>
                      </div>
                      {recap.map((g) => (
                        <div
                          key={g.title}
                          style={{ borderTop: '1px solid rgba(123,82,240,.14)', padding: '14px 0' }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{g.title}</h3>
                            <button
                              type="button"
                              className="cr-g"
                              onClick={g.edit}
                              aria-label={`Modifier : ${g.title}`}
                            >
                              Modifier
                            </button>
                          </div>
                          <dl style={{ margin: '4px 0 0', display: 'grid', gap: 8 }}>
                            {g.rows.map((r) => (
                              <div
                                key={r.k}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(110px,.45fr) 1fr',
                                  gap: 16,
                                  alignItems: 'baseline',
                                }}
                              >
                                <dt style={{ fontSize: 14, color: '#625C78' }}>{r.k}</dt>
                                <dd
                                  style={{
                                    margin: 0,
                                    fontSize: 15,
                                    lineHeight: 1.5,
                                    overflowWrap: 'anywhere',
                                    whiteSpace: 'pre-line',
                                  }}
                                >
                                  {r.v}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid rgba(123,82,240,.14)', paddingTop: 16 }}>
                        <div className="cr-sw" style={{ borderBottom: 0 }}>
                          <span className="t" id="consent-t" style={{ fontSize: 15 }}>
                            J'accepte que mes informations soient utilisées pour répondre à ma demande.{' '}
                            <a href="/confidentialite" target="_blank" rel="noopener">
                              Politique de confidentialité
                            </a>
                          </span>
                          <button
                            type="button"
                            id="consent"
                            role="switch"
                            aria-checked={consent}
                            aria-labelledby="consent-t"
                            onClick={() => {
                              setConsent(!consent);
                              setConsentErr(false);
                            }}
                          >
                            <i />
                          </button>
                        </div>
                        <div className={`cr-e ${consentErr ? 'o' : ''}`} role="alert">
                          <div>
                            <p>Cochez cette case pour envoyer votre demande.</p>
                          </div>
                        </div>
                        {cfg && (
                          <div style={{ marginTop: 14 }}>
                            <Turnstile
                              siteKey={cfg.turnstileSiteKey}
                              scriptUrl={cfg.turnstileScriptUrl}
                              resetKey={tsReset}
                              onToken={(t) => {
                                setToken(t);
                                if (t) setTokenErr('');
                              }}
                              onFail={() =>
                                setTokenErr(
                                  'La vérification anti-robot n’a pas pu se charger. Rechargez la page.',
                                )
                              }
                            />
                          </div>
                        )}
                        {cfgFail && (
                          <p role="alert" style={{ margin: '12px 0 0', fontSize: 15, color: '#8E1B33' }}>
                            Le formulaire n’a pas pu être préparé.{' '}
                            <button type="button" className="cr-g" onClick={loadConfig}>
                              Réessayer
                            </button>
                          </p>
                        )}
                        <div className={`cr-e ${tokenErr ? 'o' : ''}`} role="alert">
                          <div>
                            <p>{tokenErr}</p>
                          </div>
                        </div>
                      </div>
                      <div className={`cr-e ${failed ? 'o' : ''}`} role="alert">
                        <div>
                          <p style={{ marginTop: 12, fontSize: 15 }}>{failed}</p>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === DONE && (
            <div style={{ maxWidth: 640, margin: 'clamp(0px,6vh,64px) auto 0', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40, animation: an(0) }}>
                <div
                  style={{
                    position: 'relative',
                    width: 150,
                    height: 150,
                    animation: 'crFloat 7s ease-in-out infinite',
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: '-45%',
                      borderRadius: '50%',
                      background: 'radial-gradient(closest-side,rgba(140,90,255,.3),transparent)',
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '1px solid rgba(123,82,240,.6)',
                      animation: 'crPulse 2.4s .9s ease-out 2 both',
                    }}
                  />
                  <div className="cr-orb" style={{ ['--s' as string]: '150px' }} />
                  <svg
                    viewBox="0 0 96 96"
                    width="52"
                    height="52"
                    aria-hidden="true"
                    style={{ position: 'absolute', left: 49, top: 49 }}
                  >
                    <path
                      d="M24 50l15 15 33-34"
                      fill="none"
                      stroke="#5A36D6"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="80"
                      strokeDashoffset="80"
                      style={{ animation: 'crDraw .7s .7s cubic-bezier(.2,.7,.2,1) forwards' }}
                    />
                  </svg>
                </div>
              </div>
              <Title text={titleText} words={words} caret={caret} size="clamp(2.6rem,8vw,4.4rem)" />
              <p
                style={{
                  margin: '22px auto 0',
                  maxWidth: '28em',
                  fontSize: 18,
                  lineHeight: 1.6,
                  color: '#625C78',
                  animation: an(2),
                }}
              >
                {done.message}
              </p>
              {cfg && (
                <p
                  style={{
                    display: 'inline-block',
                    margin: '28px 0 0',
                    padding: '9px 16px',
                    borderRadius: 999,
                    background: 'rgba(123,82,240,.1)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#5A36D6',
                    animation: an(3),
                  }}
                >
                  {formatResponseDelay(cfg.responseDelayHours)}
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {step <= RC && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 6,
            background: 'rgba(255,255,255,.8)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(123,82,240,.12)',
            padding: 'calc(12px) clamp(16px,4vw,32px) calc(12px + env(safe-area-inset-bottom))',
          }}
        >
          <div
            style={{
              width: 'min(100%,1120px)',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {step > 0 && (
              <button type="button" className="cr-g" onClick={prev} style={{ paddingLeft: 0, flex: 'none' }}>
                Précédent
              </button>
            )}
            <span
              className="cr-sv"
              aria-live="polite"
              style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 13, color: '#625C78' }}
            >
              {uploading ? 'Envoi des fichiers en cours…' : 'Vos réponses sont enregistrées automatiquement.'}
            </span>
            <button
              type="button"
              className="cr-b"
              onClick={next}
              aria-busy={sending}
              disabled={uploading && step === RC}
              style={{ margin: step === 0 ? '0 auto' : '0 0 0 auto' }}
            >
              {!sending && !sendOk && <span>{nextLabel}</span>}
              {sending && <span className="cr-sp" role="status" aria-label="Envoi en cours" />}
              {sendOk && (
                <svg viewBox="0 0 20 20" width="22" height="22" aria-label="Envoyé">
                  <path
                    d="M4 10.5l4 4 8-9"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="22"
                    strokeDashoffset="22"
                    style={{ animation: 'crDraw .5s ease forwards' }}
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
