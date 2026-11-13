import { useRef } from 'react';
import { optionLabel, type Block } from '@cree/shared';

export interface Loc {
  id: number;
  v: string;
  open: boolean;
}
export interface FileItem {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  id?: string;
  error?: string;
}

export interface BlockProps {
  block: Block;
  value: unknown;
  error: string;
  showError: boolean;
  shake: boolean;
  anim: string;
  locs: Loc[];
  files: FileItem[];
  onSet(id: string, v: unknown): void;
  onTouch(id: string): void;
  onLocChange(id: number, v: string): void;
  onLocAdd(): void;
  onLocRemove(id: number): void;
  onFiles(list: FileList): void;
  onFileRemove(key: string): void;
  onFileRetry(key: string): void;
}

const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* vibration non prise en charge */
  }
};

function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 10.5l4 4 8-9"
        fill="none"
        stroke="#5A36D6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BlockView(p: BlockProps) {
  const { block: b, value, error, showError } = p;
  const opt = b.req ? '' : 'facultatif';
  const fileInput = useRef<HTMLInputElement>(null);

  let field: React.ReactNode;

  if (b.kind === 'text' || b.kind === 'area') {
    const v = typeof value === 'string' ? value : '';
    const cls = `cr-f ${b.type === 'date' ? 'up ' : ''}${showError ? 'bad ' : ''}${v !== '' && !error ? 'ok' : ''}`;
    const common = {
      id: `f-${b.id}`,
      placeholder: ' ',
      value: v,
      onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
        p.onSet(b.id, e.target.value),
      onBlur: () => p.onTouch(b.id),
      'aria-describedby': `e-${b.id}`,
    };
    field = (
      <div className={cls}>
        {b.kind === 'area' ? (
          <textarea {...common} maxLength={4000} />
        ) : (
          <input
            {...common}
            type={b.type ?? 'text'}
            autoComplete={b.auto ?? 'off'}
            aria-required={!!b.req}
            aria-invalid={showError}
            maxLength={300}
          />
        )}
        <label htmlFor={`f-${b.id}`}>{b.label}</label>
        <i />
        {b.kind === 'text' && <b />}
        <span className="cr-t">{opt}</span>
      </div>
    );
  } else {
    let control: React.ReactNode = null;
    if (b.kind === 'choice') {
      const v = (b.multi ? (Array.isArray(value) ? value : []) : (value ?? '')) as string[] | string;
      const pill = b.style === 'chips';
      control = (
        <div
          style={{
            display: pill ? 'flex' : 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {(b.options ?? []).map((o, k) => {
            const lab = optionLabel(o);
            const colors = typeof o === 'string' ? [] : o.colors;
            const on = b.multi ? (v as string[]).includes(lab) : v === lab;
            return (
              <button
                key={lab}
                type="button"
                id={`o-${b.id}-${k}`}
                className={`cr-c ${pill ? 'pill' : 'card'}`}
                aria-pressed={on}
                onClick={() => {
                  buzz();
                  p.onTouch(b.id);
                  if (b.multi)
                    p.onSet(b.id, on ? (v as string[]).filter((y) => y !== lab) : [...(v as string[]), lab]);
                  else p.onSet(b.id, on ? '' : lab);
                }}
              >
                {colors.length > 0 && (
                  <span aria-hidden="true" style={{ display: 'flex', flex: 'none' }}>
                    {colors.map((c) => (
                      <span
                        key={c}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          marginRight: -5,
                          border: '1px solid rgba(21,17,42,.2)',
                          background: c,
                        }}
                      />
                    ))}
                  </span>
                )}
                <span>{lab}</span>
                <Check />
              </button>
            );
          })}
        </div>
      );
    }
    if (b.kind === 'range') {
      const min = b.min ?? 0;
      const max = b.max ?? 100;
      const v = typeof value === 'number' ? value : (b.def ?? min);
      const f = (v - min) / (max - min);
      const shown = `≈ ${v} ${b.unit ?? ''}`;
      control = (
        <>
          <div style={{ position: 'relative', height: 38 }}>
            <output
              style={{
                position: 'absolute',
                bottom: 0,
                left: `calc(12px + (100% - 24px) * ${f})`,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontSize: 30,
                transition: 'left .55s cubic-bezier(.34,1.56,.64,1)',
              }}
            >
              {shown}
            </output>
          </div>
          <input
            className="cr-r"
            type="range"
            min={min}
            max={max}
            step={b.step}
            value={v}
            onChange={(e) => p.onSet(b.id, Number(e.target.value))}
            aria-labelledby={`lb-${b.id}`}
            aria-valuetext={shown}
            style={{ ['--p' as string]: `${f * 100}%` }}
          />
          <div
            aria-hidden="true"
            style={{
              margin: '0 12px',
              height: 6,
              background: 'repeating-linear-gradient(90deg,rgba(123,82,240,.55) 0 1px,transparent 1px 10%)',
              borderRight: '1px solid rgba(123,82,240,.55)',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              fontSize: 12,
              color: '#625C78',
            }}
          >
            <span>{b.minLabel}</span>
            <span>{b.maxLabel}</span>
          </div>
        </>
      );
    }
    if (b.kind === 'scale') {
      const v = typeof value === 'number' ? value : (b.def ?? 0);
      const n = b.options?.length ?? 1;
      control = (
        <div className="cr-seg">
          <div style={{ width: `${100 / n}%`, transform: `translateX(${v * 100}%)` }} />
          {(b.options ?? []).map((o, k) => (
            <button
              key={optionLabel(o)}
              type="button"
              id={`o-${b.id}-${k}`}
              aria-pressed={v === k}
              onClick={() => {
                buzz();
                p.onSet(b.id, k);
              }}
            >
              {optionLabel(o)}
            </button>
          ))}
        </div>
      );
    }
    if (b.kind === 'toggles') {
      const v = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div>
          {(b.options ?? []).map((o, k) => {
            const lab = optionLabel(o);
            const on = v.includes(lab);
            return (
              <div className="cr-sw" key={lab}>
                <span className="t" id={`t-${b.id}-${k}`}>
                  {lab}
                </span>
                <button
                  type="button"
                  role="switch"
                  id={`o-${b.id}-${k}`}
                  aria-checked={on}
                  aria-labelledby={`t-${b.id}-${k}`}
                  onClick={() => {
                    buzz();
                    p.onSet(b.id, on ? v.filter((y) => y !== lab) : [...v, lab]);
                  }}
                >
                  <i />
                </button>
              </div>
            );
          })}
        </div>
      );
    }
    if (b.kind === 'locations') {
      control = (
        <div>
          {p.locs.map((l, k) => {
            const label = p.locs.length > 1 ? `${b.place} ${k + 1}` : (b.place ?? '');
            return (
              <div key={l.id} className={`cr-e ${l.open ? 'o' : ''}`}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 12 }}>
                    <div className={`cr-f ${l.v.trim() ? 'ok' : ''}`} style={{ flex: 1, minWidth: 0 }}>
                      <input
                        id={`loc-${l.id}`}
                        type="text"
                        placeholder=" "
                        value={l.v}
                        maxLength={300}
                        autoComplete="off"
                        onChange={(e) => p.onLocChange(l.id, e.target.value)}
                      />
                      <label htmlFor={`loc-${l.id}`}>{label}</label>
                      <i />
                      <b />
                    </div>
                    {p.locs.length > 1 && (
                      <button
                        type="button"
                        className="cr-g"
                        style={{ padding: '0 8px' }}
                        onClick={() => p.onLocRemove(l.id)}
                        aria-label={`Retirer ${label}`}
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {p.locs.length < 5 && (
            <button type="button" className="cr-g" style={{ paddingLeft: 0 }} onClick={p.onLocAdd}>
              +&nbsp; Ajouter un lieu
            </button>
          )}
        </div>
      );
    }
    if (b.kind === 'file') {
      control = (
        <div>
          <label className="cr-file">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,application/pdf,video/mp4,video/quicktime"
              onChange={(e) => {
                if (e.target.files?.length) p.onFiles(e.target.files);
                e.target.value = '';
              }}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />
            <span>Choisir des fichiers</span>
          </label>
          {p.files.map((f) => (
            <div
              key={f.key}
              style={{ borderBottom: '1px solid rgba(123,82,240,.25)', padding: '8px 0', fontSize: 15 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  minHeight: 40,
                }}
              >
                <span style={{ overflowWrap: 'anywhere' }}>{f.name}</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {f.status === 'error' && (
                    <button
                      type="button"
                      className="cr-g"
                      onClick={() => p.onFileRetry(f.key)}
                      aria-label={`Réessayer ${f.name}`}
                    >
                      Réessayer
                    </button>
                  )}
                  <button
                    type="button"
                    className="cr-g"
                    onClick={() => p.onFileRemove(f.key)}
                    aria-label={`Retirer ${f.name}`}
                  >
                    Retirer
                  </button>
                </span>
              </div>
              {f.status === 'uploading' && (
                <div
                  role="progressbar"
                  aria-label={`Envoi de ${f.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(f.progress * 100)}
                  style={{
                    height: 4,
                    borderRadius: 4,
                    background: 'rgba(123,82,240,.14)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: '100%',
                      transformOrigin: 'left',
                      transform: `scaleX(${f.progress})`,
                      background: '#6A3DE8',
                      transition: 'transform .2s',
                    }}
                  />
                </div>
              )}
              {f.status === 'done' && <span style={{ fontSize: 13, color: '#5A36D6' }}>Envoyé</span>}
              {f.status === 'error' && (
                <span role="alert" style={{ fontSize: 13, color: '#8E1B33' }}>
                  {f.error}
                </span>
              )}
            </div>
          ))}
          <p style={{ margin: '10px 0 0', fontSize: 14, color: '#625C78' }}>{b.hint}</p>
        </div>
      );
    }
    field = (
      <div role="group" aria-labelledby={`lb-${b.id}`}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <span id={`lb-${b.id}`} className="cr-lb">
            {b.label}
          </span>
          <span className="cr-o2">{opt}</span>
        </div>
        {control}
      </div>
    );
  }

  return (
    <div id={`b-${b.id}`} style={{ animation: p.anim }}>
      <div style={{ animation: p.shake ? 'crShake .5s ease' : 'none' }}>
        {field}
        <div className={`cr-e ${showError ? 'o' : ''}`} id={`e-${b.id}`} aria-live="polite">
          <div>
            <p>{error}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
