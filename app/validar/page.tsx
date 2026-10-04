import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ValidarClient from "@/components/validar-client";

export const dynamic = "force-dynamic";

export default async function ValidarPage() {
  const s = await getSession();
  if (!s) redirect("/login?next=/validar");
  return (
    <>
      <p className="crumbs">Personal · {s.name} ({s.role})</p>
      <ValidarClient gate0="Puerta A" />
    </>
  );
}
