"use client";

import { VDSSectionHeader } from "@/components/ui/vds";

interface SectionHeaderProps { title: string; subtitle: string; href?: string; linkLabel?: string; isRtl: boolean; }
export default function SectionHeader(props: SectionHeaderProps) { return <VDSSectionHeader {...props} />; }
