"use client";

import type { DossierDetail } from "@clair/data";
import {
  Badge,
  Card,
  ChambreBadge,
  DossierCard,
  ExpandableText,
  Link,
  ProvenanceLabel,
  SectionHeader,
  StatCard,
} from "@clair/ui";
import classes from "./DossierFicheScreen.module.css";

const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? "s" : ""}`;

/** Commissions saisies, la saisine au fond avant les saisines pour avis (ordre de l'API). */
const Commissions = ({ commissions }: { commissions: DossierDetail["commissions"] }) => (
  <section className={classes.section} aria-labelledby="commissions">
    <SectionHeader id="commissions" title="Commissions saisies" />
    <ul className={classes.commissions}>
      {commissions.map((commission) => (
        <li key={`${commission.slug}-${commission.role}`} className={classes.commission}>
          <Badge tone={commission.role === "fond" ? "info" : "neutre"} size="sm">
            {commission.role === "fond" ? "Au fond" : "Pour avis"}
          </Badge>
          <span className={classes.commissionNom}>
            <Link href={`/commissions/${commission.slug}`}>{commission.nom}</Link>
            <ChambreBadge chambre={commission.chambre} short size="sm" />
          </span>
        </li>
      ))}
    </ul>
  </section>
);

/** Résumé généré par IA, toujours signalé comme tel. */
const ResumeIA = ({ resume }: { resume: string }) => (
  <section className={`${classes.section} ${classes.resume}`} aria-labelledby="en-clair">
    <div className={classes.resumeEnTete}>
      <h2 id="en-clair" className={classes.resumeTitre}>
        En clair
      </h2>
      <ProvenanceLabel provenance="ia" methodologyHref="/methodologie#enrichissement-ia" />
    </div>
    <ExpandableText maxLength={600}>{resume}</ExpandableText>
  </section>
);

/** Chiffres du dossier : scrutins (dont adoptés et rejetés) et amendements. */
const Chiffres = ({ dossier }: { dossier: DossierDetail }) => (
  <section className={classes.section} aria-labelledby="chiffres">
    <h2 id="chiffres" className="clair-visually-hidden">
      Chiffres du dossier
    </h2>
    <ul className={classes.chiffres}>
      <StatCard
        as="li"
        label={pluriel(dossier.scrutinsCount, "Scrutin")}
        value={dossier.scrutinsCount}
      />
      <StatCard
        as="li"
        label={`Scrutin${dossier.stats.totalAdopte > 1 ? "s" : ""} adopté${dossier.stats.totalAdopte > 1 ? "s" : ""}`}
        value={dossier.stats.totalAdopte}
      />
      <StatCard
        as="li"
        label={`Scrutin${dossier.stats.totalRejete > 1 ? "s" : ""} rejeté${dossier.stats.totalRejete > 1 ? "s" : ""}`}
        value={dossier.stats.totalRejete}
      />
      <StatCard
        as="li"
        label={pluriel(dossier.amendementsCount, "Amendement")}
        value={dossier.amendementsCount}
      />
    </ul>
  </section>
);

/** Loi promulguée : numéro, publication au Journal officiel et liens officiels. */
const LoiPromulguee = ({ dossier }: { dossier: DossierDetail }) =>
  dossier.loiNumero ? (
    <section className={classes.section} aria-labelledby="loi">
      <h2 id="loi" className="clair-visually-hidden">
        Loi promulguée
      </h2>
      <DossierCard
        titleAs="h3"
        dossier={{
          titre: dossier.loiTitre ? `Loi ${dossier.loiTitre}` : `Loi n° ${dossier.loiNumero}`,
          etat: "promulgue",
          loiNumero: dossier.loiNumero,
          loiDateJO: dossier.loiDateJO,
          urlLegifrance: dossier.urlLegifrance,
          urlJournalOfficiel: dossier.urlJournalOfficiel,
        }}
      />
    </section>
  ) : null;

/** Sur un rapport ou une mission : la loi dont il examine l'application. */
const LoiAppliquee = ({ loi }: { loi: NonNullable<DossierDetail["loiAppliquee"]> }) => (
  <section className={classes.section} aria-labelledby="loi-appliquee">
    <h2 id="loi-appliquee" className="clair-visually-hidden">
      Loi concernée
    </h2>
    <Card
      href={`/dossiers/${encodeURIComponent(loi.uid)}`}
      title={loi.titre}
      eyebrow={
        <Badge tone="neutre">Porte sur la loi{loi.loiNumero ? ` n° ${loi.loiNumero}` : ""}</Badge>
      }
    />
  </section>
);

/** Rapports et missions d'application de la loi, sans vote propre. */
const TravauxApplication = ({ travaux }: { travaux: DossierDetail["travauxApplication"] }) => (
  <section className={classes.section} aria-labelledby="travaux-application">
    <SectionHeader
      id="travaux-application"
      title={`Travaux d'application (${travaux.length})`}
      description="Rapports et missions portant sur cette loi, sans vote propre."
    />
    <ul className={classes.liste}>
      {travaux.map((travail) => (
        <Card
          key={travail.uid}
          as="li"
          href={`/dossiers/${encodeURIComponent(travail.uid)}`}
          title={travail.titre}
          eyebrow={
            <>
              <ChambreBadge chambre={travail.chambre} short size="sm" />
              {travail.procedureLibelle ? (
                <Badge tone="neutre" size="sm">
                  {travail.procedureLibelle}
                </Badge>
              ) : null}
            </>
          }
        />
      ))}
    </ul>
  </section>
);

/**
 * Contexte d'un dossier, entre l'en-tête et les onglets : commissions saisies, résumé IA
 * (signalé), chiffres, loi promulguée, loi appliquée et travaux d'application.
 */
export const DossierContexte = ({ dossier }: { dossier: DossierDetail }) => (
  <>
    {dossier.commissions.length > 0 ? <Commissions commissions={dossier.commissions} /> : null}
    {dossier.resumeIA ? <ResumeIA resume={dossier.resumeIA} /> : null}
    <Chiffres dossier={dossier} />
    <LoiPromulguee dossier={dossier} />
    {dossier.loiAppliquee ? <LoiAppliquee loi={dossier.loiAppliquee} /> : null}
    {dossier.travauxApplication.length > 0 ? (
      <TravauxApplication travaux={dossier.travauxApplication} />
    ) : null}
  </>
);
