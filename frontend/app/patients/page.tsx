/**
 * Patient Table page (`/patients`) — one of the two pages required by the
 * spec. Delegates the page heading (rendered alongside the filters toggle)
 * and all data-fetching, search, filtering, sorting, and pagination to
 * `PatientTable`.
 */

import { PatientTable } from "@/components/patients/PatientTable";

/** Top-level route component for `/patients`. */
export default function PatientsPage() {
  return <PatientTable />;
}
