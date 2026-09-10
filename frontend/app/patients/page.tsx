import { PatientTable } from "@/components/patients/PatientTable";

export default function PatientsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Patients</h1>
      <PatientTable />
    </div>
  );
}
