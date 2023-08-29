// a rollback occurs at the github actions level by checking out origin/main
// and then doing the SUBMIT step again. as a result, this package is just
// the same as SUBMIT
import 'monorepo/ci/submit.js';
