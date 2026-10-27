import {
  chartPalette,
  colors,
  contrastRatio,
  palette,
  parliamentaryGroups,
  radius,
  shadows,
  spacing,
  typeScale,
  voteChartColors,
} from "@clair/theme";
import classes from "./Tokens.module.css";

type SwatchProps = { name: string; value: string; note?: string };

const Swatch = ({ name, value, note }: SwatchProps) => (
  <div className={classes.swatch}>
    <div className={classes.sample} style={{ background: value }} />
    <div className={classes.legend}>
      <strong>{name}</strong>
      <code>{value}</code>
      {note ? <small>{note}</small> : null}
    </div>
  </div>
);

export type SwatchSet = "palette" | "clair" | "sombre" | "groupes" | "graphiques";

/** Nuancier lu directement dans `@clair/theme` : la documentation ne peut pas diverger du code. */
export const ColorSwatches = ({ set }: { set: SwatchSet }) => {
  const entries: SwatchProps[] =
    set === "palette"
      ? Object.entries(palette).map(([name, value]) => ({ name, value }))
      : set === "clair" || set === "sombre"
        ? Object.entries(colors[set]).map(([name, value]) => ({ name: `--clair-${name}`, value }))
        : set === "groupes"
          ? Object.entries(parliamentaryGroups).map(([code, group]) => ({
              name: `${code} · --clair-groupe-${code.toLowerCase()}`,
              value: group.color,
              note: group.label,
            }))
          : [
              ...Object.entries(voteChartColors).map(([name, value]) => ({
                name: `--clair-graphique-vote-${name}`,
                value,
              })),
              ...chartPalette.map((value, index) => ({ name: `graphique ${index + 1}`, value })),
            ];
  return (
    <div className={classes.swatches}>
      {entries.map((entry) => (
        <Swatch key={entry.name} {...entry} />
      ))}
    </div>
  );
};

const PAIRS = [
  ["texte-defaut", "fond-page"],
  ["texte-mention", "fond-page"],
  ["texte-mention", "fond-neutre"],
  ["texte-action", "fond-page"],
  ["texte-sur-action", "fond-action"],
  ["statut-succes", "statut-succes-fond"],
  ["statut-erreur", "statut-erreur-fond"],
  ["statut-avertissement", "statut-avertissement-fond"],
  ["statut-info", "statut-info-fond"],
  ["chambre-assemblee", "chambre-assemblee-fond"],
  ["chambre-senat", "chambre-senat-fond"],
] as const;

/** Contraste WCAG des principaux couples texte / fond, dans les deux thèmes. */
export const ContrastTable = () => (
  <table className={classes.table}>
    <thead>
      <tr>
        <th scope="col">Texte</th>
        <th scope="col">Fond</th>
        <th scope="col">Clair</th>
        <th scope="col">Sombre</th>
      </tr>
    </thead>
    <tbody>
      {PAIRS.map(([fg, bg]) => (
        <tr key={`${fg}-${bg}`}>
          <td>
            <code>--clair-{fg}</code>
          </td>
          <td>
            <code>--clair-{bg}</code>
          </td>
          {(["clair", "sombre"] as const).map((scheme) => (
            <td key={scheme}>
              <span
                className={classes.contrastSample}
                style={{ color: colors[scheme][fg], background: colors[scheme][bg] }}
              >
                Aa
              </span>{" "}
              {contrastRatio(colors[scheme][fg], colors[scheme][bg]).toFixed(1)}:1
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

/** Échelle typographique. */
export const TypeScale = () => (
  <table className={classes.table}>
    <thead>
      <tr>
        <th scope="col">Style</th>
        <th scope="col">Aperçu</th>
        <th scope="col">Taille / interligne</th>
        <th scope="col">Graisse</th>
      </tr>
    </thead>
    <tbody>
      {Object.entries(typeScale).map(([name, style]) => (
        <tr key={name}>
          <td>
            <code>--clair-texte-{name}-*</code>
          </td>
          <td
            style={{
              fontSize: Math.min(style.size, 30),
              lineHeight: `${style.lineHeight}px`,
              fontWeight: style.weight,
            }}
          >
            {name === "chiffre" ? "577" : "Projet de loi de finances"}
          </td>
          <td>
            {style.size} / {style.lineHeight} px
          </td>
          <td>{style.weight}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/** Grille d'espacements (1v = 4 px). */
export const SpacingScale = () => (
  <table className={classes.table}>
    <thead>
      <tr>
        <th scope="col">Token</th>
        <th scope="col">Valeur</th>
        <th scope="col">Aperçu</th>
      </tr>
    </thead>
    <tbody>
      {Object.entries(spacing).map(([name, value]) => (
        <tr key={name}>
          <td>
            <code>--clair-espacement-{name}</code>
          </td>
          <td>{value} px</td>
          <td>
            <span className={classes.bar} style={{ width: value }} />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

/** Rayons et ombres. */
export const RadiusScale = () => (
  <>
    <div className={classes.swatches}>
      {Object.entries(radius).map(([name, value]) => (
        <div key={name} className={classes.swatch}>
          <div className={classes.radius} style={{ borderRadius: Math.min(value, 24) }} />
          <div className={classes.legend}>
            <code>--clair-rayon-{name}</code>
            <small>{value} px</small>
          </div>
        </div>
      ))}
    </div>
    <div className={classes.swatches}>
      {Object.entries(shadows).map(([name, value]) => (
        <div key={name} className={classes.swatch}>
          <div className={classes.shadow} style={{ boxShadow: value }} />
          <div className={classes.legend}>
            <code>--clair-ombre-{name}</code>
          </div>
        </div>
      ))}
    </div>
  </>
);
