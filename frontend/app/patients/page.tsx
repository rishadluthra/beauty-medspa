/**
 * Patient Table page (`/patients`) — one of the two pages required by the
 * spec. Renders the page heading and delegates all data-fetching, search,
 * filtering, sorting, and pagination to `PatientTable`.
 */

import { PatientTable } from "@/components/patients/PatientTable";

/** Top-level route component for `/patients`. */
export default function PatientsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Patients</h1>
      <PatientTable />
    </div>
  );
}
