import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../lib/api';
import { formatRawLabel } from '../../constants/constants';
import { useAppTheme } from '../../contexts/ThemeContext';
import { centeredContent, FORM_CONTENT_MAX_WIDTH } from '../../utils/responsive';

interface ProjectOption {
  id: number;
  name: string;
}

interface UserOption {
  id: number;
  name: string;
  email?: string;
  role?: string;
}

interface MilestoneOption {
  id: number;
  project_id?: number;
  project_phase_id?: number;
  milestone_name?: string;
  name?: string;
  title?: string;
  sequence?: number;
  sequence_no?: number;
  sort_order?: number;
  display_order?: number;
  milestone_order?: number;
  order?: number;
  position?: number;
  start_date?: string;
  due_date?: string;
  created_at?: string;
}

interface PhaseOption {
  id: number;
  project_id?: number;
  phase_key?: string;
  phase_title?: string;
  name?: string;
  sequence?: number;
  sequence_no?: number;
  sort_order?: number;
  display_order?: number;
  phase_order?: number;
  order?: number;
  position?: number;
  milestones?: MilestoneOption[];
}

interface PickedAttachment {
  uri: string;
  name: string;
  type: string;
}

type SelectorKind = 'project' | 'phase' | 'milestone' | 'assignedTo' | 'priority';

interface SelectorOption {
  value: string;
  label: string;
  detail?: string;
}

interface FormLabelProps {
  children: React.ReactNode;
  color: string;
}

interface FieldErrorTextProps {
  message?: string;
  color: string;
}

interface FieldWrapProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectFieldProps {
  value: string;
  placeholder: string;
  onPress: () => void;
  inputStyle: object;
  textColor: string;
  mutedColor: string;
  disabled?: boolean;
}

interface SectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  cardBg: string;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  labelColor: string;
}

interface AddTaskScreenProps {
  visible: boolean;
  onClose: () => void;
  userId: number;
  projects: ProjectOption[];
  onTaskAdded: () => void;
}

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PHASE_ORDER = [
  'Preparation Planning',
  'Procurement',
  'Mobilization',
  'Execution',
  'Completion',
  'Close Out',
];

const numericOrder = (item: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const number = Number(item[key]);
    if (Number.isFinite(number)) return number;
  }
  return null;
};

const phaseLabel = (phase: PhaseOption) =>
  formatRawLabel(phase.phase_title || phase.name || phase.phase_key || '', 'Untitled Phase');

const milestoneLabel = (milestone: MilestoneOption) =>
  formatRawLabel(milestone.milestone_name || milestone.name || milestone.title || '', 'Untitled Milestone');

const sortPhases = (phases: PhaseOption[]) =>
  [...phases].sort((a, b) => {
    const aOrder = numericOrder(a, ['sequence', 'sequence_no', 'sort_order', 'display_order', 'phase_order', 'order', 'position']);
    const bOrder = numericOrder(b, ['sequence', 'sequence_no', 'sort_order', 'display_order', 'phase_order', 'order', 'position']);
    if (aOrder !== null || bOrder !== null) return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
    const aIndex = PHASE_ORDER.indexOf(phaseLabel(a));
    const bIndex = PHASE_ORDER.indexOf(phaseLabel(b));
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });

const sortMilestones = (milestones: MilestoneOption[]) =>
  [...milestones].sort((a, b) => {
    const aOrder = numericOrder(a, ['sequence', 'sequence_no', 'sort_order', 'display_order', 'milestone_order', 'order', 'position']);
    const bOrder = numericOrder(b, ['sequence', 'sequence_no', 'sort_order', 'display_order', 'milestone_order', 'order', 'position']);
    if (aOrder !== null || bOrder !== null) return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
    for (const key of ['start_date', 'due_date', 'created_at']) {
      const aValue = a[key as keyof MilestoneOption];
      const bValue = b[key as keyof MilestoneOption];
      const aTime = aValue ? new Date(String(aValue)).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = bValue ? new Date(String(bValue)).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
    }
    return milestoneLabel(a).localeCompare(milestoneLabel(b));
  });

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value: string) => {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const displayDate = (value: string) => {
  if (!value) return 'mm/dd/yyyy';
  const [year, month, day] = value.split('-');
  return month && day && year ? `${month}/${day}/${year}` : value;
};

const FormLabel = ({ children, color }: FormLabelProps) => (
  <Text className="mb-2 text-[12px] font-bold" style={{ color }}>
    {children}
  </Text>
);

const FieldErrorText = ({ message, color }: FieldErrorTextProps) =>
  message ? <Text className="mt-1 text-[11px]" style={{ color }}>{message}</Text> : null;

const FieldWrap = ({ children, className = '' }: FieldWrapProps) => (
  <View className={`mb-4 ${className}`}>{children}</View>
);

const SelectField = ({
  value,
  placeholder,
  onPress,
  inputStyle,
  textColor,
  mutedColor,
  disabled = false,
}: SelectFieldProps) => (
  <TouchableOpacity
    activeOpacity={0.82}
    disabled={disabled}
    onPress={onPress}
    className="h-[48px] flex-row items-center justify-between rounded-xl border px-4"
    style={[inputStyle, disabled ? { opacity: 0.55 } : null]}
  >
    <Text
      className="mr-3 flex-1 text-[14px]"
      numberOfLines={1}
      style={{ color: value ? textColor : mutedColor }}
    >
      {value || placeholder}
    </Text>
    <Ionicons name="chevron-down" size={17} color={mutedColor} />
  </TouchableOpacity>
);

const Section = ({
  title,
  icon,
  children,
  cardBg,
  borderColor,
  iconBg,
  iconColor,
  labelColor,
}: SectionProps) => (
  <View className="mb-3 rounded-2xl border p-3" style={{ backgroundColor: cardBg, borderColor }}>
    <View className="mb-3 flex-row items-center">
      <View className="mr-2 h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: iconBg }}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text className="text-[14px] font-bold" style={{ color: labelColor }}>{title}</Text>
    </View>
    {children}
  </View>
);

export default function AddTaskScreen({
  visible,
  onClose,
  userId,
  projects,
  onTaskAdded,
}: AddTaskScreenProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const formContentStyle = centeredContent(width, FORM_CONTENT_MAX_WIDTH);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dbProjects, setDbProjects] = useState<ProjectOption[]>(projects);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selector, setSelector] = useState<SelectorKind | null>(null);

  const [projectId, setProjectId] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [milestones, setMilestones] = useState<MilestoneOption[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState(toDateInput(new Date()));
  const [dueDate, setDueDate] = useState(toDateInput(new Date()));
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successVisible, setSuccessVisible] = useState(false);

  const projectOptions = dbProjects.length > 0 ? dbProjects : projects;

  const selectedProjectLabel = useMemo(
    () => projectOptions.find((project) => String(project.id) === projectId)?.name || '',
    [projectId, projectOptions]
  );

  const selectedAssigneeLabel = useMemo(() => {
    const user = users.find((item) => String(item.id) === assignedTo);
    if (!user) return '';
    return `${user.name}${user.role ? ` - ${user.role}` : ''}`;
  }, [assignedTo, users]);

  const selectedPhaseLabel = useMemo(() => {
    const phase = phases.find((item) => String(item.id) === phaseId);
    return phase ? phaseLabel(phase) : '';
  }, [phaseId, phases]);

  const selectedMilestoneLabel = useMemo(() => {
    const milestone = milestones.find((item) => String(item.id) === milestoneId);
    return milestone ? milestoneLabel(milestone) : '';
  }, [milestoneId, milestones]);

  const selectedPriorityLabel = PRIORITIES.find((item) => item.value === priority)?.label || '';

  const selectorConfig = useMemo(() => {
    if (!selector) return null;

    if (selector === 'project') {
      return {
        title: 'Select Project',
        selectedValue: projectId,
        emptyText: 'No projects available.',
        options: projectOptions.map((project) => ({
          value: String(project.id),
          label: project.name,
        })),
      };
    }

    if (selector === 'assignedTo') {
      return {
        title: 'Assign To',
        selectedValue: assignedTo,
        emptyText: 'No users available.',
        options: users.map((user) => ({
          value: String(user.id),
          label: user.name,
          detail: user.role || user.email,
        })),
      };
    }

    if (selector === 'phase') {
      return {
        title: 'Select Phase',
        selectedValue: phaseId,
        emptyText: projectId ? 'No phases available for this project.' : 'Select a project first.',
        options: phases.map((phase) => ({
          value: String(phase.id),
          label: phaseLabel(phase),
        })),
      };
    }

    if (selector === 'milestone') {
      return {
        title: 'Select Milestone',
        selectedValue: milestoneId,
        emptyText: phaseId ? 'No milestones available for this phase.' : 'Select a phase first.',
        options: milestones.map((milestone) => ({
          value: String(milestone.id),
          label: milestoneLabel(milestone),
        })),
      };
    }

    return {
      title: 'Priority Level',
      selectedValue: priority,
      emptyText: 'No priority options available.',
      options: PRIORITIES.map((item) => ({
        value: item.value,
        label: item.label,
      })),
    };
  }, [
    assignedTo,
    phaseId,
    milestoneId,
    phases,
    milestones,
    priority,
    projectId,
    projectOptions,
    selector,
    users,
  ]);

  const isDirty = Boolean(
    projectId ||
      phaseId ||
      milestoneId ||
      title.trim() ||
      description.trim() ||
      assignedTo ||
      startDate ||
      dueDate ||
      attachment
  );

  const isDark = theme.mode === 'dark';
  const modalBg = isDark ? '#111118' : theme.background;
  const cardBg = isDark ? '#15151E' : theme.elevated;
  const fieldBg = isDark ? '#171720' : theme.input;
  const fieldBorder = isDark ? '#242432' : theme.border;
  const labelColor = isDark ? '#F4F4FA' : theme.text;
  const mutedColor = isDark ? '#8F8FA3' : theme.textMuted;

  const inputStyle = {
    backgroundColor: fieldBg,
    borderColor: fieldBorder,
    color: theme.text,
  };
  const sectionStyleProps = {
    cardBg,
    borderColor: fieldBorder,
    iconBg: theme.primaryLight,
    iconColor: theme.primary,
    labelColor,
  };
  const selectStyleProps = {
    inputStyle,
    textColor: theme.text,
    mutedColor,
  };

  const resetForm = () => {
    setProjectId('');
    setPhaseId('');
    setMilestoneId('');
    setPhases([]);
    setMilestones([]);
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setPriority('medium');
    const today = toDateInput(new Date());
    setStartDate(today);
    setDueDate(today);
    setAttachment(null);
    setErrors({});
    setShowStartPicker(false);
    setShowEndPicker(false);
    setSelector(null);
  };

  useEffect(() => {
    if (!visible) return;
    const today = toDateInput(new Date());
    setStartDate(today);
    setDueDate(today);
    setDbProjects(projects);
    setLoadingMeta(true);
    fetch(`${API_URL}/tasks/meta`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.projects)) setDbProjects(data.projects);
        if (Array.isArray(data.users)) setUsers(data.users);
      })
      .catch((err) => {
        console.error('Failed to fetch task metadata:', err);
        Alert.alert('Error', 'Could not load task form options.');
      })
      .finally(() => setLoadingMeta(false));
  }, [projects, visible]);

  useEffect(() => {
    if (!visible || !projectId) return;
    setLoadingPlan(true);
    setPhaseId('');
    setMilestoneId('');
    setMilestones([]);
    fetch(`${API_URL}/projects/${projectId}/milestone-plan`)
      .then((res) => res.json())
      .then((data) => {
        setPhases(Array.isArray(data?.phases) ? sortPhases(data.phases) : []);
      })
      .catch((err) => {
        console.error('Failed to fetch milestone plan:', err);
        setPhases([]);
      })
      .finally(() => setLoadingPlan(false));
  }, [projectId, visible]);

  useEffect(() => {
    const phase = phases.find((item) => String(item.id) === phaseId);
    setMilestoneId('');
    setMilestones(phase?.milestones ? sortMilestones(phase.milestones) : []);
  }, [phaseId, phases]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!projectId) nextErrors.project_id = 'Project is required.';
    if (!title.trim()) nextErrors.title = 'Task title is required.';
    if (!phaseId) nextErrors.phase_id = 'Phase is required.';
    if (!milestoneId) nextErrors.milestone_id = 'Milestone is required.';
    if (!assignedTo) nextErrors.assigned_to = 'Assigned user is required.';
    if (!priority) nextErrors.priority = 'Priority is required.';
    if (!startDate) nextErrors.start_date = 'Start date is required.';
    if (!dueDate) nextErrors.due_date = 'Due date is required.';
    if (startDate && dueDate && dueDate < startDate) {
      nextErrors.due_date = 'Due date cannot be earlier than the start date.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const openSelector = (kind: SelectorKind) => {
    Keyboard.dismiss();
    setSelector(kind);
  };

  const handleSelectOption = (value: string) => {
    if (!selector) return;

    if (selector === 'project') {
      setProjectId(value);
      setPhaseId('');
      setMilestoneId('');
      setPhases([]);
      setMilestones([]);
      setErrors((prev) => ({ ...prev, project_id: '' }));
    } else if (selector === 'phase') {
      setPhaseId(value);
      setMilestoneId('');
      setErrors((prev) => ({ ...prev, phase_id: '', milestone_id: '' }));
    } else if (selector === 'milestone') {
      setMilestoneId(value);
      setErrors((prev) => ({ ...prev, milestone_id: '' }));
    } else if (selector === 'assignedTo') {
      setAssignedTo(value);
      setErrors((prev) => ({ ...prev, assigned_to: '' }));
    } else {
      setPriority(value);
      setErrors((prev) => ({ ...prev, priority: '' }));
    }

    setSelector(null);
  };

  const requestClose = () => {
    if (!isDirty) {
      resetForm();
      onClose();
      return;
    }

    Alert.alert('Discard task draft?', 'Your entered task details will not be saved.', [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          resetForm();
          onClose();
        },
      },
    ]);
  };

  const pickAttachment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const name = asset.fileName || `task_attachment_${Date.now()}.jpg`;
    setAttachment({
      uri: asset.uri,
      name,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const onDateChange = (
    event: DateTimePickerEvent,
    selectedDate: Date | undefined,
    field: 'start' | 'end'
  ) => {
    if (Platform.OS !== 'ios') {
      setShowStartPicker(false);
      setShowEndPicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    const formatted = toDateInput(selectedDate);
    if (field === 'start') {
      setStartDate(formatted);
      setErrors((prev) => ({
        ...prev,
        start_date: '',
        due_date: dueDate && dueDate < formatted ? 'Due date cannot be earlier than the start date.' : '',
      }));
    } else {
      setDueDate(formatted);
      setErrors((prev) => ({
        ...prev,
        due_date: startDate && formatted < startDate ? 'Due date cannot be earlier than the start date.' : '',
      }));
    }
  };

  const submit = async () => {
    if (!validate()) {
      Alert.alert('Missing information', 'Please complete all required task fields.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('project_id', projectId);
      formData.append('phase_id', phaseId);
      formData.append('milestone_id', milestoneId);
      formData.append('description', description.trim());
      formData.append('assigned_to', assignedTo);
      formData.append('priority', priority);
      formData.append('status', 'pending');
      formData.append('start_date', startDate);
      formData.append('due_date', dueDate);
      formData.append('created_by', String(userId));
      formData.append('visibility_scope', 'public');

      if (attachment) {
        formData.append('attachments', {
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.type,
        } as any);
      }

      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors(data.errors || {});
        Alert.alert('Could not create task', data.error || data.message || 'Please check the task details.');
        return;
      }

      resetForm();
      onTaskAdded();
      setSuccessVisible(true);
    } catch (error) {
      console.error('Error adding task:', error);
      Alert.alert('Connection Error', 'Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const SelectorSheet = () => {
    if (!selectorConfig) return null;
    const options: SelectorOption[] = selectorConfig.options;

    return (
      <View
        className="justify-end"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.46)',
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSelector(null)}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          className="rounded-t-[28px] border-t px-5 pt-4"
          style={{
            backgroundColor: cardBg,
            borderColor: fieldBorder,
            maxHeight: '72%',
            paddingBottom: Math.max(insets.bottom + 12, 24),
          }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[18px] font-bold" style={{ color: labelColor }}>
              {selectorConfig.title}
            </Text>
            <TouchableOpacity
              onPress={() => setSelector(null)}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: fieldBg }}
            >
              <Ionicons name="close" size={18} color={mutedColor} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {options.length === 0 ? (
              <View className="items-center py-10">
                <Text className="text-center text-[13px]" style={{ color: mutedColor }}>
                  {selectorConfig.emptyText}
                </Text>
              </View>
            ) : (
              options.map((option) => {
                const selected = option.value === selectorConfig.selectedValue;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.78}
                    onPress={() => handleSelectOption(option.value)}
                    className="mb-2 min-h-[52px] flex-row items-center rounded-xl px-3"
                    style={{ backgroundColor: selected ? theme.primaryLight : fieldBg }}
                  >
                    <View className="flex-1">
                      <Text
                        className="text-[14px] font-semibold"
                        numberOfLines={1}
                        style={{ color: selected ? theme.primary : theme.text }}
                      >
                        {option.label}
                      </Text>
                      {option.detail ? (
                        <Text className="mt-0.5 text-[11px]" numberOfLines={1} style={{ color: mutedColor }}>
                          {option.detail}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={theme.primary} /> : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={requestClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ backgroundColor: modalBg }}
      >
        <View
          className="border-b pb-4"
          style={[formContentStyle, { paddingTop: Math.max(insets.top + 12, 48), borderColor: fieldBorder, backgroundColor: cardBg }]}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={requestClose}
              className="mr-3 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: fieldBg }}
            >
              <Ionicons name="close" size={21} color={mutedColor} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-[22px] font-bold" style={{ color: theme.primary }}>Add New Task</Text>
              <Text className="mt-1 text-[12px]" style={{ color: mutedColor }}>Create and assign a new project task</Text>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: Math.max(insets.bottom + 104, 132) }}
        >
          <View style={formContentStyle}>
            {loadingMeta ? (
              <View className="items-center rounded-2xl border py-12" style={{ backgroundColor: cardBg, borderColor: fieldBorder }}>
                <ActivityIndicator color={theme.primary} />
                <Text className="mt-3 text-[13px]" style={{ color: mutedColor }}>Loading task options...</Text>
              </View>
            ) : (
              <>
                <Section title="Project Details" icon="folder-open-outline" {...sectionStyleProps}>
                  <FieldWrap>
                    <FormLabel color={labelColor}>Project *</FormLabel>
                    <SelectField
                      value={selectedProjectLabel}
                      placeholder="Select project"
                      onPress={() => openSelector('project')}
                      {...selectStyleProps}
                    />
                    <FieldErrorText message={errors.project_id} color={theme.danger} />
                  </FieldWrap>
                  <FieldWrap>
                    <FormLabel color={labelColor}>Phase *</FormLabel>
                    <SelectField
                      value={selectedPhaseLabel}
                      placeholder={loadingPlan ? 'Loading phases...' : 'Select phase'}
                      disabled={!projectId || loadingPlan}
                      onPress={() => openSelector('phase')}
                      {...selectStyleProps}
                    />
                    <FieldErrorText message={errors.phase_id} color={theme.danger} />
                  </FieldWrap>
                  <FieldWrap className="mb-0">
                    <FormLabel color={labelColor}>Milestone *</FormLabel>
                    <SelectField
                      value={selectedMilestoneLabel}
                      placeholder="Select milestone"
                      disabled={!phaseId}
                      onPress={() => openSelector('milestone')}
                      {...selectStyleProps}
                    />
                    <FieldErrorText message={errors.milestone_id} color={theme.danger} />
                  </FieldWrap>
                </Section>

                <Section title="Task Information" icon="document-text-outline" {...sectionStyleProps}>
                  <FieldWrap>
                    <FormLabel color={labelColor}>Task Title *</FormLabel>
                    <TextInput
                      value={title}
                      onChangeText={(value) => {
                        setTitle(value);
                        setErrors((prev) => ({ ...prev, title: '' }));
                      }}
                      placeholder="Enter the title of the task here"
                      placeholderTextColor={mutedColor}
                      className="h-[48px] rounded-xl border px-4 text-[14px]"
                      style={inputStyle}
                      returnKeyType="next"
                    />
                    <FieldErrorText message={errors.title} color={theme.danger} />
                  </FieldWrap>

                  <FieldWrap className="mb-0">
                    <FormLabel color={labelColor}>Task Description (optional)</FormLabel>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Enter the description of the task here"
                      placeholderTextColor={mutedColor}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[96px] rounded-xl border px-4 py-3 text-[14px]"
                      style={inputStyle}
                    />
                  </FieldWrap>
                </Section>

                <Section title="Assignment" icon="people-outline" {...sectionStyleProps}>
                  <FieldWrap>
                    <FormLabel color={labelColor}>Assigned To *</FormLabel>
                    <SelectField
                      value={selectedAssigneeLabel}
                      placeholder="Select assignee"
                      onPress={() => openSelector('assignedTo')}
                      {...selectStyleProps}
                    />
                    <FieldErrorText message={errors.assigned_to} color={theme.danger} />
                  </FieldWrap>

                  <FieldWrap className="mb-0">
                    <FormLabel color={labelColor}>Priority Level *</FormLabel>
                    <SelectField
                      value={selectedPriorityLabel}
                      placeholder="Select priority"
                      onPress={() => openSelector('priority')}
                      {...selectStyleProps}
                    />
                    <FieldErrorText message={errors.priority} color={theme.danger} />
                  </FieldWrap>
                </Section>

                <Section title="Schedule" icon="calendar-outline" {...sectionStyleProps}>
                  <FieldWrap>
                    <FormLabel color={labelColor}>Start Date *</FormLabel>
                    <TouchableOpacity
                      onPress={() => {
                        setShowEndPicker(false);
                        setShowStartPicker((current) => !current);
                      }}
                      className="h-[52px] flex-row items-center justify-between rounded-xl border px-4"
                      style={[
                        inputStyle,
                        showStartPicker ? { borderColor: theme.primary, backgroundColor: theme.primaryLight } : null,
                      ]}>
                      <View>
                        <Text className="text-[10px] font-semibold uppercase" style={{ color: mutedColor }}>Starts</Text>
                        <Text className="mt-0.5 text-[14px] font-semibold" style={{ color: startDate ? theme.text : mutedColor }}>
                          {displayDate(startDate)}
                        </Text>
                      </View>
                      <Ionicons name="calendar-outline" size={16} color={mutedColor} />
                    </TouchableOpacity>
                    <FieldErrorText message={errors.start_date} color={theme.danger} />
                  </FieldWrap>

                  <FieldWrap className="mb-0">
                    <FormLabel color={labelColor}>Finish Date *</FormLabel>
                    <TouchableOpacity
                      onPress={() => {
                        setShowStartPicker(false);
                        setShowEndPicker((current) => !current);
                      }}
                      className="h-[52px] flex-row items-center justify-between rounded-xl border px-4"
                      style={[
                        inputStyle,
                        showEndPicker ? { borderColor: theme.primary, backgroundColor: theme.primaryLight } : null,
                        errors.due_date ? { borderColor: theme.danger } : null,
                      ]}>
                      <View>
                        <Text className="text-[10px] font-semibold uppercase" style={{ color: mutedColor }}>Finishes</Text>
                        <Text className="mt-0.5 text-[14px] font-semibold" style={{ color: dueDate ? theme.text : mutedColor }}>
                          {displayDate(dueDate)}
                        </Text>
                      </View>
                      <Ionicons name="calendar-outline" size={16} color={mutedColor} />
                    </TouchableOpacity>
                    <FieldErrorText message={errors.due_date} color={theme.danger} />
                  </FieldWrap>

                  {showStartPicker && (
                    <DateTimePicker
                      value={parseDate(startDate)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(event, date) => onDateChange(event, date, 'start')}
                    />
                  )}
                  {showEndPicker && (
                    <DateTimePicker
                      value={parseDate(dueDate || startDate)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(event, date) => onDateChange(event, date, 'end')}
                    />
                  )}
                </Section>

                <Section title="Attachments" icon="attach-outline" {...sectionStyleProps}>
                  <View className="flex-row items-center">
                    <TouchableOpacity
                      onPress={pickAttachment}
                      className="mr-3 h-9 justify-center rounded-lg px-3"
                      style={{ backgroundColor: theme.primaryLight }}>
                      <Text className="text-[12px] font-semibold" style={{ color: theme.primary }}>Choose Files</Text>
                    </TouchableOpacity>
                    <Text className="flex-1 text-[12px]" numberOfLines={1} style={{ color: mutedColor }}>
                      {attachment ? attachment.name : 'No file chosen'}
                    </Text>
                  </View>
                  {attachment && (
                    <TouchableOpacity onPress={() => setAttachment(null)} className="mt-2 self-start">
                      <Text className="text-[12px] font-semibold" style={{ color: theme.danger }}>Remove attachment</Text>
                    </TouchableOpacity>
                  )}
                </Section>
              </>
            )}
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 border-t pt-3"
          style={{ paddingBottom: Math.max(insets.bottom + 10, 20), backgroundColor: cardBg, borderColor: fieldBorder }}
        >
          <View style={formContentStyle}>
            <TouchableOpacity
              onPress={submit}
              disabled={submitting || loadingMeta}
              className="h-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: submitting || loadingMeta ? theme.primaryPressed : theme.primary, opacity: submitting || loadingMeta ? 0.78 : 1 }}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-[15px] font-bold text-white">Create Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        <Modal visible={successVisible} transparent animationType="fade">
          <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
            <View className="w-full rounded-[24px] p-6" style={{ backgroundColor: theme.elevated, maxWidth: 420 }}>
              <View className="mb-4 h-16 w-16 items-center justify-center self-center rounded-full" style={{ backgroundColor: theme.primary }}>
                <Ionicons name="checkmark" size={34} color="white" />
              </View>
              <Text className="text-center text-[20px] font-bold" style={{ color: theme.text }}>Task Added.</Text>
              <Text className="mt-2 text-center text-[14px] leading-5" style={{ color: theme.textMuted }}>
                Task added. Please inform the assignee.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSuccessVisible(false);
                  onClose();
                }}
                className="mt-6 h-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: theme.primary }}>
                <Text className="text-[14px] font-bold text-white">Back to Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <SelectorSheet />
      </KeyboardAvoidingView>
    </Modal>
  );
}
