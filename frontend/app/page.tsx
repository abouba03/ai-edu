import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  GraduationCap,
  ShieldCheck,
  UserRound,
  CheckCircle2,
  LayoutPanelTop,
} from 'lucide-react';

const vkrMeta = {
  author: 'Kaba Aboubacar',
  university: 'Университет',
  year: '2025-2026',
  supervisor: 'Моругин С.Л.',
  program: 'Технологии проектирования информационных систем и технологий',
  topic: 'Интеллектуальная платформа обучения Python с применением ИИ',
};

export default function Home() {
  const contributions = [
    'Педагогическая персонализация на основе данных обучения.',
    'Унифицированный конвейер ИИ: генерация, оценка, коррекция и мотивация.',
    'Практико-ориентированный интерфейс с измеряемым прогрессом и немедленной обратной связью.',
  ];

  const demoFlow = [
    { label: 'Курсы', href: '/courses', note: 'Структурированное обучение по модулям' },
    { label: 'Генератор ИИ', href: '/generator', note: 'Адаптивное создание тестов и упражнений' },
    { label: 'Вызовы', href: '/challenges', note: 'Проверка навыков в реальных условиях' },
    { label: 'Корректор', href: '/corrector', note: 'Подробная педагогическая обратная связь' },
  ];

  return (
    <div className="space-y-3">
      <section className="border-2 border-[#1C293C] bg-[linear-gradient(120deg,#FBFBF9_0%,#F5F8FF_100%)] p-4 shadow-[4px_4px_0px_0px_#1C293C]">
        <div className="space-y-2.5">
          <p className="inline-flex items-center gap-1.5 border border-[#432DD7] bg-white px-2 py-1 text-[10px] uppercase tracking-widest font-black text-[#432DD7]">
            <LayoutPanelTop className="h-3 w-3" /> Презентация ВКР
          </p>
          <h1 className="text-2xl lg:text-[2rem] font-black text-[#1C293C] leading-tight">
            {vkrMeta.topic}
          </h1>
          <p className="text-sm text-[#1C293C]/65 font-medium max-w-4xl">
            Этот магистерский проект предлагает платформу EdTech на базе искусственного интеллекта,
            предназначенную для повышения вовлеченности учащихся в изучение Python через полный цикл:
            обучение, оценка, коррекция и отслеживание прогресса.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <article className="lg:col-span-4 border-2 border-[#1C293C] bg-white p-3 shadow-[3px_3px_0px_0px_#1C293C] space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Академическая информация</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-1.5 text-xs font-semibold text-[#1C293C]">
              <UserRound className="h-3.5 w-3.5 text-[#432DD7]" /> Автор: {vkrMeta.author}
            </div>
            <div className="flex items-center gap-2 border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-1.5 text-xs font-semibold text-[#1C293C]">
              <Calendar className="h-3.5 w-3.5 text-[#432DD7]" /> Год: {vkrMeta.year}
            </div>
            <div className="flex items-center gap-2 border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-1.5 text-xs font-semibold text-[#1C293C]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#432DD7]" /> Руководитель: {vkrMeta.supervisor}
            </div>
            <div className="flex items-center gap-2 border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-1.5 text-xs font-semibold text-[#1C293C]">
              <BookOpen className="h-3.5 w-3.5 text-[#432DD7]" /> Программа: {vkrMeta.program}
            </div>
          </div>
        </article>

        <article className="lg:col-span-5 border-2 border-[#1C293C] bg-white p-3 shadow-[3px_3px_0px_0px_#1C293C] space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Резюме работы</p>
          <p className="text-xs font-medium text-[#1C293C]/75 leading-relaxed">
            Работа рассматривает следующий вопрос: как создать среду обучения Python, которая остается простой
            для студента, но при этом педагогически грамотна. Выбранный подход сочетает педагогическую организацию,
            адаптацию по уровню и непрерывную обратную связь ИИ.
          </p>

          <div className="space-y-1.5">
            {contributions.map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 border border-[#1C293C]/20 bg-[#FBFBF9] px-2.5 py-2 text-[11px] font-medium text-[#1C293C]/80"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#432DD7] shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="border-2 border-[#1C293C] bg-white p-3 shadow-[3px_3px_0px_0px_#1C293C] space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7]">Демонстрационный путь</p>
          <span className="border border-[#1C293C]/25 bg-[#FBFBF9] px-2 py-1 text-[10px] font-bold text-[#1C293C]/70">
            Демо: 4 модуля
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {demoFlow.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="border-2 border-[#1C293C] bg-[#FBFBF9] px-3 py-2 shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-[#1C293C]">{section.label}</p>
                <ArrowRight className="h-3.5 w-3.5 text-[#432DD7]" />
              </div>
              <p className="mt-1 text-[11px] text-[#1C293C]/60 font-medium">{section.note}</p>
            </Link>
          ))}
        </div>

        <div className="border border-[#1C293C]/20 bg-[#FBFBF9] px-3 py-2 text-xs font-medium text-[#1C293C]/70">
          Эта страница служит введением к защите: контекст работы, научное позиционирование,
          техническая демонстрация и прямая навигация к функциональным компонентам платформы.
        </div>
      </section>
    </div>
  );
}
