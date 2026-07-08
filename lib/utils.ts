import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function projectSubject(value: string) {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function cleanProjectTitle(title: string) {
  const normalized = projectSubject(title);
  const cloneMatch = normalized.match(/^(.+?)(?:을|를) 참고한 미니 클론 만들기(?: 기반 미니 프로젝트)?$/);
  if (cloneMatch?.[1]) {
    return `${projectSubject(cloneMatch[1])}처럼 핵심 기능 만들어보기`;
  }

  const basedMatch = normalized.match(/^(.+?) 기반 미니 프로젝트$/);
  if (basedMatch?.[1]) {
    return `${projectSubject(basedMatch[1])}로 시작하는 실전 미니 프로젝트`;
  }

  return normalized;
}
