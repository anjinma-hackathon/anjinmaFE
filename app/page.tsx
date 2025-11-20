import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-24">
      <h1 className="text-4xl font-bold">교육약자 실시간 번역 서비스</h1>
      <div className="flex gap-4">
        <Link
          href="/student"
          className="rounded-lg bg-blue-500 px-6 py-3 text-white hover:bg-blue-600"
        >
          학생 페이지
        </Link>
        <Link
          href="/professor"
          className="rounded-lg bg-green-500 px-6 py-3 text-white hover:bg-green-600"
        >
          교수 페이지
        </Link>
      </div>
    </main>
  );
}
