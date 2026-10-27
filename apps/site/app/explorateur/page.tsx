import { notFound } from "next/navigation";

/**
 * Explorateur de données : désactivé sur apps/web depuis janvier 2026 (la page y répond 404, en
 * attendant que la fonctionnalité soit prête). Le nouveau site garde ce comportement : l'adresse
 * existe, et sert la page « introuvable ».
 */
const Page = () => notFound();

export default Page;
