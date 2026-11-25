// Draws one slide. Each layout reads only the fields it needs from talk.md.

import { mediaUrl, parseBar, parseCard } from "../talk/format.js";
import { settings } from "./talk.js";

const THUMB = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("thumb");

function Title({ text, className = "slide-title" }) {
  if (!text) return null;
  return <h1 className={className}>{text}</h1>;
}

function Points({ points, through, numbered = true }) {
  if (!points?.length) return null;
  const List = numbered ? "ol" : "ul";
  return (
    <List className={`points${numbered ? " is-numbered" : ""}`}>
      {points.map((point, i) => {
        const shown = through == null || i < through;
        return (
          <li
            key={i}
            className={through != null ? `piece${shown ? " is-shown" : ""}` : undefined}
            aria-hidden={!shown || undefined}
            style={{ "--i": i }}
          >
            {point}
          </li>
        );
      })}
    </List>
  );
}

function Copy({ slide, numbered }) {
  const f = slide.fields;
  return (
    <div className="copy">
      <Title text={slide.title} />
      {f.text ? <p className="support">{f.text}</p> : null}
      <Points points={f.points} through={slide.through} numbered={numbered} />
    </div>
  );
}

function Picture({ src, alt = "" }) {
  return <img className="picture" src={mediaUrl(src)} alt={alt} draggable={false} />;
}

function Video({ src }) {
  const url = mediaUrl(src);
  if (THUMB) return <video className="picture" src={`${url}#t=0.1`} muted playsInline preload="metadata" />;
  return <video className="picture" src={url} autoPlay muted loop playsInline preload="auto" />;
}

function CodeWindow({ code, lang }) {
  const lines = (code ?? "").split("\n");
  const size = lines.length > 16 ? "is-small" : lines.length > 10 ? "is-medium" : "";
  return (
    <div className="window is-dark">
      <div className="window-bar">
        <i />
        <i />
        <i />
        {lang ? <span className="window-title">{lang}</span> : null}
      </div>
      <pre className={`code ${size}`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** The picture side of a split slide: an image, a video, or code. */
function Visual({ fields }) {
  if (fields.video) return <Video src={fields.video} />;
  if (fields.code) return <CodeWindow code={fields.code} lang={fields.lang} />;
  if (fields.image) return <Picture src={fields.image} alt={fields.caption ?? ""} />;
  return null;
}

function Chart({ bars }) {
  const rows = bars.map(parseBar);
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="chart" role="img" aria-label={rows.map((r) => `${r.label}: ${r.value}${r.unit}`).join(", ")}>
      {rows.map((row, i) => (
        <div key={i} className="chart-row" style={{ "--i": i }}>
          <span className="chart-label">{row.label}</span>
          <span className="chart-track">
            <span className="chart-bar" style={{ "--w": `${(Math.abs(row.value) / max) * 100}%` }} />
            <b className="chart-value">
              {row.value}
              {row.unit}
            </b>
          </span>
        </div>
      ))}
    </div>
  );
}

export function SlideBody({ slide }) {
  const f = slide.fields;
  switch (slide.layout) {
    case "cover":
      return (
        <div className="body body-cover">
          <div className="copy">
            {settings.event ? <p className="eyebrow">{settings.event}</p> : null}
            <Title text={slide.title || settings.title} />
            {f.subtitle || f.text ? <p className="support">{f.subtitle || f.text}</p> : null}
            {settings.speaker ? <p className="byline">{settings.speaker}</p> : null}
          </div>
          <div className="visual">{f.image ? <Picture src={f.image} /> : <div className="cover-art" aria-hidden="true"><i /><i /><i /></div>}</div>
        </div>
      );
    case "statement":
      return (
        <div className="body body-statement">
          <Title text={slide.title || f.text} />
          {slide.title && f.text ? <p className="support">{f.text}</p> : null}
        </div>
      );
    case "text":
      return (
        <div className="body body-text">
          <Copy slide={slide} numbered={false} />
        </div>
      );
    case "list":
      return (
        <div className="body body-list">
          <Copy slide={slide} numbered />
        </div>
      );
    case "split": {
      const side = f.side === "right" ? "right" : "left";
      return (
        <div className={`body body-split picture-${side}`}>
          <div className="visual">
            <Visual fields={f} />
            {f.caption ? <p className="caption">{f.caption}</p> : null}
          </div>
          <Copy slide={slide} numbered={false} />
        </div>
      );
    }
    case "image":
      return (
        <div className="body body-image">
          <Picture src={f.image} alt={f.caption ?? slide.title} />
          {slide.title || f.caption ? (
            <div className="image-caption">
              <Title text={slide.title} />
              {f.caption ? <p className="caption">{f.caption}</p> : null}
            </div>
          ) : null}
        </div>
      );
    case "quote":
      return (
        <figure className="body body-quote">
          <blockquote className="quote">{f.quote}</blockquote>
          {f.by ? <figcaption className="by">{f.by}</figcaption> : null}
        </figure>
      );
    case "compare": {
      const cards = [parseCard(f.left), parseCard(f.right)];
      return (
        <div className="body body-compare">
          <Title text={slide.title} />
          <div className="cards">
            {cards.map((card, i) => (
              <div key={i} className="card" style={{ "--i": i }}>
                {card.label ? <span className="card-label">{card.label}</span> : null}
                <span className="card-body">{card.body}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "code":
      return (
        <div className="body body-code">
          <div className="copy">
            <Title text={slide.title} />
            {f.text ? <p className="support">{f.text}</p> : null}
          </div>
          <div className="visual">
            <CodeWindow code={f.code} lang={f.lang} />
          </div>
        </div>
      );
    case "video":
      return (
        <div className="body body-video">
          <Video src={f.video} />
          {slide.title || f.caption ? <p className="caption">{slide.title || f.caption}</p> : null}
        </div>
      );
    case "chart":
      return (
        <div className="body body-chart">
          <div className="copy">
            <Title text={slide.title} />
            {f.text ? <p className="support">{f.text}</p> : null}
          </div>
          <Chart bars={f.bars ?? []} />
          {f.caption ? <p className="caption">{f.caption}</p> : null}
        </div>
      );
    case "number":
      return (
        <div className="body body-number">
          <p className={`big-number${String(f.number).length > 9 ? " is-longer" : String(f.number).length > 5 ? " is-long" : ""}`}>{f.number}</p>
          {f.label ? <p className="number-label">{f.label}</p> : null}
          {slide.title || f.text ? <p className="support">{slide.title || f.text}</p> : null}
        </div>
      );
    case "closing":
      return (
        <div className="body body-closing">
          <div className="copy">
            <Title text={slide.title || "Thank you"} />
            {f.text ? <p className="support">{f.text}</p> : null}
            {f.link ? <p className="link">{f.link}</p> : null}
          </div>
          {f.image ? (
            <div className="visual">
              <Picture src={f.image} alt={f.caption ?? ""} />
            </div>
          ) : null}
        </div>
      );
    default:
      return (
        <div className="body body-text">
          <Copy slide={slide} numbered={false} />
        </div>
      );
  }
}
