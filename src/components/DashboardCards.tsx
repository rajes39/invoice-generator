export default function DashboardCards({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-green-100 bg-white p-6 shadow-sm dark:border-green-900/30 dark:bg-slate-900 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="absolute top-0 left-0 w-1 h-full bg-green-500 group-hover:w-2 transition-all"></div>
      <p className="text-[10px] uppercase tracking-[0.3em] text-green-600 font-black dark:text-green-500">{label}</p>
      <p className="mt-4 text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">{value}</p>
    </div>
  );
}
