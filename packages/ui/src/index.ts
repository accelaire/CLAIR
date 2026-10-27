// Exports publics de @clair/ui, triés par chemin (Biome) : charts (graphiques), core
// (fondations), filters (filtres), layout (mise en page), lib (navigation, utilitaires),
// parliament (parlementaire). Pas de commentaires de section : le tri les déplacerait.
export {
  BarChart,
  type BarChartDatum,
  type BarChartProps,
  type BarChartSeries,
} from "./charts/bar-chart/index.ts";
export {
  ChartFrame,
  type ChartFrameProps,
  type ChartTable,
  type ChartTableColumn,
  type ChartTableValue,
} from "./charts/chart-frame/index.ts";
export {
  assignSeats,
  describeHemicycle,
  Hemicycle,
  type HemicycleGroup,
  type HemicycleProps,
  rowCountFor,
  type SeatPosition,
  seatPositions,
  seatsPerRow,
} from "./charts/hemicycle/index.ts";
export { Aide, type AideProps } from "./core/aide/index.ts";
export { Badge, type BadgeProps, type BadgeTone } from "./core/badge/index.ts";
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./core/button/index.ts";
export {
  Callout,
  type CalloutAction,
  type CalloutProps,
  type CalloutTone,
} from "./core/callout/index.ts";
export { Card, type CardHeading, type CardProps } from "./core/card/index.ts";
export {
  CHAMBRES,
  type Chambre,
  ChambreBadge,
  type ChambreBadgeProps,
} from "./core/chambre-badge/index.ts";
export { ExpandableText, type ExpandableTextProps } from "./core/expandable-text/index.ts";
export { Faq, type FaqItem, type FaqProps } from "./core/faq/index.ts";
export { Link, type LinkProps } from "./core/link/index.ts";
export {
  type Provenance,
  ProvenanceLabel,
  type ProvenanceLabelProps,
} from "./core/provenance-label/index.ts";
export {
  EmptyState,
  type EmptyStateProps,
  ErrorState,
  type ErrorStateProps,
  LoadingState,
  type LoadingStateProps,
} from "./core/query-states/index.ts";
export { SkipLink, type SkipLinkProps } from "./core/skip-link/index.ts";
export { StatCard, type StatCardProps, type StatCardVariation } from "./core/stat-card/index.ts";
export {
  parseStatut,
  STATUTS,
  type Statut,
  StatutBadge,
  type StatutBadgeProps,
  type StatutDefinition,
} from "./core/statut-badge/index.ts";
export { ThemeToggle } from "./core/theme-toggle/index.ts";
export {
  VOTE_POSITIONS,
  VotePosition,
  type VotePositionProps,
  type VotePositionValue,
} from "./core/vote-position/index.ts";
export {
  type CalendrierJour,
  CalendrierMois,
  type CalendrierMoisProps,
} from "./filters/calendrier-mois/index.ts";
export {
  ChambreSwitch,
  type ChambreSwitchProps,
  type ChambreSwitchValue,
} from "./filters/chambre-switch/index.ts";
export {
  ComparisonBar,
  type ComparisonBarProps,
  type ComparisonItem,
} from "./filters/comparison-bar/index.ts";
export {
  buildDateRangePresets,
  type DateRange,
  DateRangePicker,
  type DateRangePickerProps,
  type DateRangePreset,
  type DateString,
} from "./filters/date-range-picker/index.ts";
export { type ActiveFilter, FilterBar, type FilterBarProps } from "./filters/filter-bar/index.ts";
export {
  MultiSelectFilter,
  type MultiSelectFilterOption,
  type MultiSelectFilterProps,
} from "./filters/multi-select-filter/index.ts";
export {
  SearchInput,
  type SearchInputLabel,
  type SearchInputProps,
} from "./filters/search-input/index.ts";
export { type SortOption, SortSelect, type SortSelectProps } from "./filters/sort-select/index.ts";
export { AppShell, type AppShellProps } from "./layout/app-shell/index.ts";
export { Bandeau, type BandeauProps, type BandeauTone } from "./layout/bandeau/index.ts";
export { Container, type ContainerProps, type ContainerSize } from "./layout/container/index.ts";
export {
  Footer,
  type FooterColumn,
  type FooterLink,
  type FooterProps,
} from "./layout/footer/index.ts";
export { Header, type HeaderProps, type NavItem, type NavLinkItem } from "./layout/header/index.ts";
export {
  Breadcrumb,
  type BreadcrumbItem,
  type BreadcrumbProps,
  PageHeader,
  type PageHeaderProps,
} from "./layout/page-header/index.ts";
export { Pagination, type PaginationProps } from "./layout/pagination/index.ts";
export { SectionHeader, type SectionHeaderProps } from "./layout/section-header/index.ts";
export { ShareButton, type ShareButtonProps } from "./layout/share-button/index.ts";
export { type TabItem, Tabs, type TabsProps } from "./layout/tabs/index.ts";
export { GithubIcon, XIcon } from "./lib/brand-icons.tsx";
export { asArray, asString, buildHref, type QueryParams, toggle } from "./lib/href.ts";
export {
  type LinkProps as RouterLinkProps,
  type Navigation,
  NavigationProvider,
  useNavigation,
} from "./lib/navigation.tsx";
export {
  AmendementCard,
  type AmendementCardData,
  type AmendementCardLink,
  type AmendementCardProps,
} from "./parliament/amendement-card/index.ts";
export {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
  type SortDirection,
} from "./parliament/data-table/index.ts";
export {
  DossierCard,
  type DossierCardData,
  type DossierCardProps,
  formatDossierTitre,
} from "./parliament/dossier-card/index.ts";
export {
  EVENEMENT_TYPES,
  EvenementCard,
  type EvenementCardProps,
  type EvenementType,
  formatEvenementDate,
  isHappeningNow,
} from "./parliament/evenement-card/index.ts";
export {
  couleurGroupe,
  GroupeBadge,
  type GroupeBadgeProps,
} from "./parliament/groupe-badge/index.ts";
export {
  LEGISLATIVE_OUTCOMES,
  type LegislativeStep,
  type LegislativeStepOutcome,
  type LegislativeStepStatus,
  LegislativeTimeline,
  type LegislativeTimelineProps,
} from "./parliament/legislative-timeline/index.ts";
export { LobbyisteLogo, type LobbyisteLogoProps } from "./parliament/lobbyiste-logo/index.ts";
export {
  type Mandat,
  type MandatFonction,
  MandatsTimeline,
  type MandatsTimelineProps,
} from "./parliament/mandats-timeline/index.ts";
export {
  initiales,
  ParlementaireAvatar,
  type ParlementaireAvatarProps,
  type ParlementaireAvatarSize,
} from "./parliament/parlementaire-avatar/index.ts";
export {
  ParlementaireCard,
  type ParlementaireCardData,
  type ParlementaireCardProps,
} from "./parliament/parlementaire-card/index.ts";
export { ResultatVote, type ResultatVoteProps } from "./parliament/resultat-vote/index.ts";
export {
  ScrutinCard,
  type ScrutinCardData,
  type ScrutinCardProps,
} from "./parliament/scrutin-card/index.ts";
export { TopFlop, type TopFlopItem, type TopFlopProps } from "./parliament/top-flop/index.ts";
