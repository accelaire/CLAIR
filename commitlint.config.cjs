// Conventional Commits : `type(portée): sujet`, en français.
// Les portées restent libres (web, api, ingestion, senatoriales, seo…) et les sujets peuvent
// être longs : seule la forme `type(portée): sujet` et la liste des types sont vérifiées.
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [0],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    "subject-case": [0],
    "scope-case": [0],
  },
};
