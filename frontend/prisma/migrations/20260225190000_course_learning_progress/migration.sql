-- CreateTable
CREATE TABLE "CourseQuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clerkId" TEXT,
    "courseSlug" TEXT NOT NULL,
    "courseTitle" TEXT,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB,
    "questions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseQuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseChallengeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clerkId" TEXT,
    "courseSlug" TEXT NOT NULL,
    "courseTitle" TEXT,
    "challengeText" TEXT,
    "submittedCode" TEXT NOT NULL,
    "evaluation" JSONB,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseChallengeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseReflection" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clerkId" TEXT,
    "courseSlug" TEXT NOT NULL,
    "courseTitle" TEXT,
    "understood" TEXT,
    "unclear" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseReflection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseQuizAttempt_clerkId_courseSlug_createdAt_idx" ON "CourseQuizAttempt"("clerkId", "courseSlug", "createdAt");

-- CreateIndex
CREATE INDEX "CourseChallengeAttempt_clerkId_courseSlug_createdAt_idx" ON "CourseChallengeAttempt"("clerkId", "courseSlug", "createdAt");

-- CreateIndex
CREATE INDEX "CourseReflection_clerkId_courseSlug_createdAt_idx" ON "CourseReflection"("clerkId", "courseSlug", "createdAt");

-- AddForeignKey
ALTER TABLE "CourseQuizAttempt" ADD CONSTRAINT "CourseQuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseChallengeAttempt" ADD CONSTRAINT "CourseChallengeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReflection" ADD CONSTRAINT "CourseReflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
