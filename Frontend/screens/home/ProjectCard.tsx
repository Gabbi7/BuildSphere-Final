import { View, Text, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

interface ProjectCardProps {
  name: string;
  location: string;
  color: string;
  progress?: number;
  daysLeft?: number;
  image?: ImageSourcePropType;
  onAction?: () => void;
}

export default function ProjectCard({
  name,
  location,
  color,
  progress = 0,
  daysLeft,
  image,
  onAction,
}: ProjectCardProps) {
  // Use the color directly (it's a hex code) or fallback to Soft Pink
  const bannerColor = color || '#FFD6F3';

  return (
    <View
      className="mb-8 overflow-hidden rounded-[35px] bg-white pb-5"
      style={{
        shadowColor: '#7370FF',
        shadowOpacity: 0.1,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}>
      {/* Banner */}
      <View style={{ backgroundColor: bannerColor, height: 200 }}>
        {image && (
          <Image
            source={image}
            className="absolute inset-0 h-full w-full"
            resizeMode="cover"
          />
        )}
        {/* 3-dot menu */}
        <TouchableOpacity 
          className="absolute right-4 top-4 h-9 w-9 items-center justify-center rounded-full bg-black/20 backdrop-blur-md" 
          onPress={onAction}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* Card Content */}
      <View className="px-6 pt-5">
        <View className="flex-row items-center mb-5">
          {/* Icon Circle */}
          <View 
            style={{ backgroundColor: `${bannerColor}15` }}
            className="mr-4 h-12 w-12 items-center justify-center rounded-2xl"
          >
            <FontAwesome5 name="building" size={22} color={bannerColor} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="flex-1 text-[16px] font-bold text-[#1E1E1E]" numberOfLines={1}>
                {name}
              </Text>

              {daysLeft !== undefined && (
                <View className="ml-2 flex-row items-center rounded-full bg-[#7370FF10] px-3 py-1">
                  <Ionicons name="time-outline" size={10} color="#7370FF" />
                  <Text className="ml-1 text-[10px] font-bold text-[#7370FF]">
                    {daysLeft}d left
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={12} color="#A3A3A3" />
              <Text className="ml-1 text-[11px] text-[#A3A3A3] font-medium" numberOfLines={1}>{location}</Text>
            </View>
          </View>
        </View>

        {/* Progress Section */}
        <View className="mt-2">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-[12px] font-semibold text-[#1E1E1E]">Project Progress</Text>
            <Text className="text-[12px] font-bold text-[#7370FF]">{progress}%</Text>
          </View>
          <View className="h-[8px] overflow-hidden rounded-full bg-[#F5F5F7]">
            <View
              style={{ width: `${progress}%` }}
              className="h-full rounded-full bg-[#7370FF]"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
