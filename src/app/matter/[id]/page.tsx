import Dashboard from "@/components/Dashboard";

export default async function MatterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Dashboard digestUrl={`/api/matters/${id}/facts`} matterId={Number(id)} />;
}
