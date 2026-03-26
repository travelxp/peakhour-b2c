"use client";

import { Mail, PenLine, Music2, type LucideIcon } from "lucide-react";
import {
  LinkedinIcon,
  TwitterIcon,
  InstagramIcon,
  YoutubeIcon,
  FacebookIcon,
} from "./brand-icons";

type IconComponent = LucideIcon | ((props: { className?: string }) => React.JSX.Element);

const CHANNELS: Record<string, { icon: IconComponent; color: string; label: string }> = {
  newsletter: { icon: Mail, color: "#6366f1", label: "Newsletter" },
  linkedin: { icon: LinkedinIcon, color: "#0A66C2", label: "LinkedIn" },
  x: { icon: TwitterIcon, color: "#000000", label: "X" },
  twitter: { icon: TwitterIcon, color: "#000000", label: "X" },
  instagram: { icon: InstagramIcon, color: "#E4405F", label: "Instagram" },
  blog: { icon: PenLine, color: "#f59e0b", label: "Blog" },
  youtube: { icon: YoutubeIcon, color: "#FF0000", label: "YouTube" },
  facebook: { icon: FacebookIcon, color: "#1877F2", label: "Facebook" },
  tiktok: { icon: Music2, color: "#000000", label: "TikTok" },
};

export function ChannelIcon({ channel, size = 16 }: { channel: string; size?: number }) {
  const ch = CHANNELS[channel.toLowerCase()];
  if (!ch) return <span className="text-xs">{channel}</span>;
  const Icon = ch.icon;

  return (
    <span className="inline-flex items-center gap-1" title={ch.label}>
      <Icon style={{ color: ch.color, width: size, height: size }} className="shrink-0" />
      <span className="text-xs text-muted-foreground">{ch.label}</span>
    </span>
  );
}

export function ChannelIconCompact({ channel, size = 14 }: { channel: string; size?: number }) {
  const ch = CHANNELS[channel.toLowerCase()];
  if (!ch) return <span className="text-[10px]">{channel}</span>;
  const Icon = ch.icon;

  return (
    <span title={ch.label}>
      <Icon style={{ color: ch.color, width: size, height: size }} className="shrink-0" />
    </span>
  );
}
