import Link from 'next/link';
import prisma from '@/lib/prisma';
import AdminShell from '../_components/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminCoursPage() {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <AdminShell>
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Section Cours</h2>
          <Link href="/admin/formation" className="rounded-lg border px-3 py-2 text-sm hover:bg-accent">
            Paramètres de création
          </Link>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Titre</th>
                <th className="text-left px-3 py-2 font-medium">Niveau</th>
                <th className="text-left px-3 py-2 font-medium">Modules</th>
                <th className="text-left px-3 py-2 font-medium">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                    Aucun cours trouvé.
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr key={course.id} className="border-t">
                    <td className="px-3 py-2">{course.title}</td>
                    <td className="px-3 py-2">{course.level}</td>
                    <td className="px-3 py-2">{course.modules ?? 0}</td>
                    <td className="px-3 py-2">{new Date(course.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
