"use client";

import type { ReactNode } from "react";
import { VDSEmptyState } from "@/components/ui/vds";

interface EmptyStateProps { icon: ReactNode; title: string; actionLabel?: string; href?: string; }
export default function EmptyState(props: EmptyStateProps) { return <VDSEmptyState {...props} />; }
