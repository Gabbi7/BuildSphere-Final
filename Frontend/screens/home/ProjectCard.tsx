import { View, Text, TouchableOpacity, Image, ImageSourcePropType, useWindowDimensions } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { softCardShadow } from '../../constants/theme';
import { formatRawLabel } from '../../constants/constants';

interface ProjectCardProps {
  name: string;
  location: string;
  color: string;
  progress?: number;
  status?: string;
  daysLeft?: number;
  image?: ImageSourcePropType;
  onAction?: () => void;
}

export default function ProjectCard({
  name,
  location,
  color,
  progress = 0,
  status = 'active',
  daysLeft,
  image,
  onAction,
}: ProjectCardProps) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  // Use the color directly (it's a hex code) or fallback to pinkish default
  const bannerColor = color || '#FFDFF2';
  const bannerHeight = width >= 768 ? 220 : width <= 360 ? 150 : 180;
  const normalizedProgress = Math.min(100, Math.max(0, Number(progress) || 0));
  const statusKey = String(status || '').toLowerCase();
  const isCompleted = statusKey.includes('completed');
  const isProposed = statusKey.includes('proposed');
  const accent = isCompleted ? '#2F9E44' : isProposed ? '#F08C00' : theme.primary;
  const statusLabel = formatRawLabel(status, 'In Progress').replace(/^Active$/, 'In Progress');

  return (
    <View
      className="mb-6 overflow-hidden rounded-[30px] pb-4"
      style={{
        backgroundColor: theme.surface,
        ...softCardShadow,
      }}>
      {/* Banner */}
      <View style={{ backgroundColor: bannerColor, height: bannerHeight }}>
        {image && (
          <Image
            source={image}
            className="absolute inset-0 h-full w-full"
            resizeMode="cover"
          />
        )}
        {/* 3-dot menu */}
        <View
          className="absolute left-3 top-3 flex-row items-center rounded-full border px-3 py-1"
          style={{ backgroundColor: '#FFFFFF', borderColor: `${accent}55` }}>
          <View className="mr-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
          <Text className="text-[10px] font-bold" style={{ color: accent }}>{statusLabel}</Text>
        </View>
        {onAction ? (
          <TouchableOpacity 
            className="absolute right-3 top-3 h-6 w-6 items-center justify-center rounded-full bg-black/10" 
            onPress={onAction}
          >
            <Ionicons name="ellipsis-vertical" size={13} color={image ? 'white' : '#000000ff'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Card Content */}
      <View className="px-5 pt-4">
        <View className="flex-row items-center mb-3">
          {/* Icon Circle */}
          <View 
            style={{ backgroundColor: `${bannerColor}26` }} // 26 is ~15% opacity in hex
            className="mr-3 h-10 w-10 items-center justify-center rounded-full"
          >
            <FontAwesome5 name="building" size={20} color={bannerColor} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-[14px] font-bold" style={{ color: theme.text }} numberOfLines={2}>
                {name}
              </Text>

              {daysLeft !== undefined && (
                <View className="ml-2 flex-row items-center rounded-md px-1.5 py-0.5" style={{ backgroundColor: theme.primaryLight, flexShrink: 0 }}>
                  <Ionicons name="time-outline" size={7} color={theme.primary} />
                  <Text className="ml-1 text-[10px] font-bold" style={{ color: theme.primary }}>
                    {daysLeft} Days Left
                  </Text>
                </View>
              )}
            </View>
            <Text className="mt-2 text-[11px]" style={{ color: theme.textMuted }} numberOfLines={2}>{location}</Text>
          </View>
        </View>

        {/* Progress Section */}
        <View className="mt-2">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-[12px] font-semibold" style={{ color: theme.textMuted }}>Progress</Text>
            <Text className="text-[12px] font-bold" style={{ color: accent }}>{normalizedProgress}%</Text>
          </View>
          <View className="h-[6px] overflow-hidden rounded-full" style={{ backgroundColor: theme.border }}>
            <View
              style={{ width: `${normalizedProgress}%`, backgroundColor: normalizedProgress > 0 ? accent : 'transparent' }}
              className="h-full rounded-full"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
