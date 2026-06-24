import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../lib/api';
import { getPermissions, type UserRole } from '../../constants/roles';
import { ACTION_TYPE_LABELS, ACTION_TYPE_COLORS } from '../../constants/constants';
import { useAppTheme } from '../../contexts/ThemeContext';
import BottomNavigationBar, { MainTab } from '../../components/BottomNavigationBar';
import { InventoryItemSkeleton, InventoryLogSkeleton } from '../../components/skeletons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { centeredContent } from '../../utils/responsive';

interface InventoryItem {
  id: number;
  project_id: number;
  item_name: string;
  category: string;
  quantity: number | string;
  critical_level: number | string;
  price: number | string;
  unit?: string;
}

interface InventoryLog {
  id: number;
  item_id: number;
  action_type: string;
  quantity: number | string;
  notes?: string | null;
  created_at: string;
  item_name: string;
  unit?: string | null;
  project_name?: string | null;
  location?: string | null;
  actor_name?: string | null;
}

interface Props {
  projectId: number;
  userId: number;
  onBack: () => void;
  userRole?: UserRole;
  activeMainTab?: MainTab;
  canViewHome?: boolean;
  unreadCount?: number;
  onNavigate?: (tab: MainTab) => void;
  showBottomNav?: boolean;
  highlightItemId?: number | null;
}

function stockStatus(qty: number | string, critical: number | string): { label: string; bg: string } {
  const q = Number(qty) || 0;
  const c = Number(critical) || 0;
  if (q <= 0) return { label: 'Out of Stock', bg: '#FF6B6B' };
  if (q <= c) return { label: 'Low Stock', bg: '#FF9F43' };
  return { label: 'In Stock', bg: '#5DBF50' };
}

const PREDEFINED_ITEMS: Record<string, string> = {
  Cement: 'Materials',
  'Extension Wire': 'Tools',
  'Glass Panels': 'Materials',
  'Welding Machine': 'Equipment',
};

const ACTION_LABELS: Record<string, string> = {
  ...ACTION_TYPE_LABELS,
  add_item: 'Added',
  update_stock: 'Stock Updated',
  delete_item: 'Deleted',
  consume: 'Consumed',
  return: 'Returned',
  correction: 'Corrected',
};

const MOBILE_ACTION_TYPES = ['RECEIVING', 'CONSUMPTION', 'SPOILAGE'] as const;
type MobileActionType = (typeof MOBILE_ACTION_TYPES)[number];

export default function InventoryScreen({
  projectId,
  userId,
  onBack,
  userRole,
  activeMainTab = 'home',
  canViewHome = true,
  unreadCount = 0,
  onNavigate,
  showBottomNav = false,
  highlightItemId = null,
}: Props) {
  const perms = getPermissions(userRole);
  const canView = perms.canViewInventory;
  const canEdit = perms.canEditInventory;
  const canAdd = perms.canAddInventory;
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const screenContentStyle = centeredContent(width);
  const headerTopPadding = Math.max(insets.top + 10, Platform.OS === 'ios' ? 64 : 20);

  const [activeTab, setActiveTab] = useState<'items' | 'logs'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAction, setSelectedAction] = useState('all');
  const [showLogTypePicker, setShowLogTypePicker] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('Materials');
  const [addCritical, setAddCritical] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState<null | 'item' | 'log'>(null);
  // Transaction modal state
  const [showTransaction, setShowTransaction] = useState(false);
  const [txnItem, setTxnItem] = useState<InventoryItem | null>(null);
  const [txnAction, setTxnAction] = useState<MobileActionType>('RECEIVING');
  const [txnQty, setTxnQty] = useState('');
  const [txnNotes, setTxnNotes] = useState('');
  const [txnTaskId, setTxnTaskId] = useState('');
  const [projectTasks, setProjectTasks] = useState<{id: number; title: string}[]>([]);
  const [showAddLog, setShowAddLog] = useState(false);
  const [logItemId, setLogItemId] = useState('');
  const [logActionType, setLogActionType] = useState<MobileActionType>('RECEIVING');
  const [logQty, setLogQty] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logTaskId, setLogTaskId] = useState('');

  const categories = ['All', 'Materials', 'Equipment', 'Others'];
  const itemCategories = ['Materials', 'Equipment', 'Others'];
  const actionTypes = ['all', ...MOBILE_ACTION_TYPES];
  const actionFilterLabels: Record<string, string> = {
    all: 'All Actions',
    RECEIVING: 'Receiving',
    CONSUMPTION: 'Consumption',
    SPOILAGE: 'Defective',
  };

  const fetchItems = async () => {
    const response = await fetch(`${API_URL}/inventory?projectId=${projectId}`);
    if (!response.ok) throw new Error('Failed to load inventory items.');
    return response.json();
  };

  const fetchLogs = async () => {
    const q = new URLSearchParams({
      projectId: String(projectId),
      search: search.trim(),
      actionType: selectedAction,
    });
    const response = await fetch(`${API_URL}/inventory/logs?${q.toString()}`);
    if (!response.ok) throw new Error('Failed to load inventory logs.');
    return response.json();
  };

  const load = async (showSkeleton = true) => {
    if (!canView) return;
    setError(null);
    if (showSkeleton) setLoading(true);
    try {
      const [itemsData, logsData] = await Promise.all([fetchItems(), fetchLogs()]);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load inventory data.');
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  const refresh = async () => {
    if (!canView) return;
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch tasks for CONSUMPTION task-linking
  const fetchTasks = async () => {
    if (!canView) return;
    try {
      const res = await fetch(`${API_URL}/tasks/project/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProjectTasks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks for linking:', err);
    }
  };

  useEffect(() => {
    if (!canView) return;
    load();
    fetchTasks();
  }, [canView, projectId, selectedAction]);

  useEffect(() => {
    if (!canView) {
      Alert.alert('Access denied', 'You do not have permission to access Inventory.', [
        { text: 'OK', onPress: onBack },
      ]);
    }
  }, [canView, onBack]);

  useEffect(() => {
    if (highlightItemId) {
      setActiveTab('items');
    }
  }, [highlightItemId]);

  const resetAddItemForm = () => {
    setAddName('');
    setAddCategory('Materials');
    setAddCritical('');
    setAddPrice('');
  };

  const resetTransactionForm = () => {
    setTxnItem(null);
    setTxnAction('RECEIVING');
    setTxnQty('');
    setTxnNotes('');
    setTxnTaskId('');
  };

  const resetAddLogForm = () => {
    setLogItemId('');
    setLogActionType('RECEIVING');
    setLogQty('');
    setLogNotes('');
    setLogTaskId('');
  };

  const hasAddItemDraft = () =>
    Boolean(
      addName.trim() ||
      addCritical.trim() ||
      addPrice.trim() ||
      addCategory !== 'Materials'
    );

  const hasTransactionDraft = () =>
    Boolean(txnItem || txnAction !== 'RECEIVING' || txnQty.trim() || txnNotes.trim() || txnTaskId);

  const hasAddLogDraft = () =>
    Boolean(logItemId || logActionType !== 'RECEIVING' || logQty.trim() || logNotes.trim() || logTaskId);

  const confirmDiscard = (hasDraft: boolean, onDiscard: () => void) => {
    if (!hasDraft) {
      onDiscard();
      return;
    }

    Alert.alert(
      'Discard changes?',
      'Your entered inventory details will not be saved.',
      [
        { text: 'Continue Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
      ]
    );
  };

  const closeAddItemModal = () => {
    confirmDiscard(hasAddItemDraft(), () => {
      setShowAdd(false);
      resetAddItemForm();
    });
  };

  const closeTransactionModal = () => {
    confirmDiscard(hasTransactionDraft(), () => {
      setShowTransaction(false);
      resetTransactionForm();
    });
  };

  const closeAddLogModal = () => {
    confirmDiscard(hasAddLogDraft(), () => {
      setShowAddLog(false);
      resetAddLogForm();
    });
  };

  const getTransactionConfirmation = (action: MobileActionType) => {
    switch (action) {
      case 'CONSUMPTION':
        return {
          title: 'Confirm inventory log?',
          message: 'This will permanently reduce stock and link the log to the selected task. Inventory logs cannot be edited after saving, so please check that the item, quantity, and notes are correct.',
        };
      case 'SPOILAGE':
        return {
          title: 'Confirm inventory log?',
          message: 'This will permanently reduce stock for defective materials. Inventory logs cannot be edited after saving, so please check that the item, quantity, and notes are correct.',
        };
      default:
        return {
          title: 'Confirm inventory log?',
          message: 'This will permanently increase stock. Inventory logs cannot be edited after saving, so please check that the item, quantity, and notes are correct.',
        };
    }
  };

  const submitAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          itemName: addName,
          category: addCategory,
          quantity: 0,
          criticalLevel: addCritical,
          price: Number(addPrice),
          unit: 'pcs',
          createdBy: userId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('Inventory add item failed', {
          endpoint: '/inventory',
          status: res.status,
          message: data?.error || data?.message,
          payloadKeys: ['projectId', 'itemName', 'category', 'quantity', 'criticalLevel', 'price', 'unit', 'createdBy'],
        });
        throw new Error(data?.error || data?.message || 'Failed to add item.');
      }
      setShowAdd(false);
      resetAddItemForm();
      await load();
      setSuccessModal('item');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add item.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!projectId) return Alert.alert('Project required', 'Please select a project before adding an inventory item.');
    if (!addName.trim()) return Alert.alert('Required', 'Item name is required.');
    if (!addCategory.trim()) return Alert.alert('Required', 'Category is required.');
    const minimumStock = Number(addCritical);
    if (!Number.isFinite(minimumStock) || minimumStock < 0) return Alert.alert('Invalid value', 'Minimum Stock must be numeric and not negative.');
    const price = Number(addPrice);
    if (!Number.isFinite(price) || price < 0) return Alert.alert('Invalid value', 'Price must be numeric and not negative.');

    Alert.alert(
      'Confirm inventory item?',
      'Please review the details before saving.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Save', onPress: submitAdd },
      ]
    );
  };

  // ── Phase 2: Record Transaction (replaces direct stock edits) ──
  const submitTransaction = async () => {
    if (!txnItem) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/inventory/${txnItem.id}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: txnAction,
          quantity: Number(txnQty),
          reference_task_id: txnAction === 'CONSUMPTION' ? txnTaskId : undefined,
          notes: txnNotes || undefined,
          created_by: userId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Transaction failed.');
      }
      setShowTransaction(false);
      resetTransactionForm();
      await load();
      setSuccessModal('log');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to record transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransaction = async () => {
    if (!txnItem) return;
    const qty = Number(txnQty);
    if (!qty || qty <= 0) return Alert.alert('Required', 'Quantity must be greater than 0.');
    if (txnAction === 'CONSUMPTION' && !txnTaskId) {
      return Alert.alert('Task Required', 'You must select a task for material consumption.');
    }

    const confirmation = getTransactionConfirmation(txnAction);
    Alert.alert(confirmation.title, confirmation.message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm Save', onPress: submitTransaction },
    ]);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Item', 'Delete this inventory item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/inventory/${id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deletedBy: userId }),
            });
            if (!res.ok) throw new Error('Delete failed.');
            Alert.alert('Success', 'Inventory item deleted.');
            await load();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete item.');
          }
        },
      },
    ]);
  };

  const submitAddLog = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/inventory/${logItemId}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: logActionType,
          quantity: Number(logQty),
          reference_task_id: logActionType === 'CONSUMPTION' ? logTaskId : undefined,
          notes: logNotes || undefined,
          created_by: userId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Transaction failed.');
      }
      setShowAddLog(false);
      resetAddLogForm();
      await load();
      setSuccessModal('log');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLog = async () => {
    if (!logItemId || !logQty) {
      return Alert.alert('Required', 'Please select item and quantity.');
    }
    const qty = Number(logQty);
    if (!qty || qty <= 0) return Alert.alert('Required', 'Quantity must be greater than 0.');
    if (logActionType === 'CONSUMPTION' && !logTaskId) {
      return Alert.alert('Task Required', 'You must select a task for material consumption.');
    }

    const confirmation = getTransactionConfirmation(logActionType);
    Alert.alert(confirmation.title, confirmation.message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm Save', onPress: submitAddLog },
    ]);
  };

  const filteredItems = useMemo(
    () =>
      items
        .filter((i) => selectedCategory === 'All' || i.category === selectedCategory)
        .filter((i) => i.item_name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => Number(b.id) - Number(a.id)),
    [items, selectedCategory, search]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (!search.trim()) return true;
      return l.item_name?.toLowerCase().includes(search.toLowerCase());
    });
  }, [logs, search]);

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: theme.input,
    fontSize: 14,
    color: theme.text,
    marginBottom: 10,
  } as const;

  if (!canView) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: theme.background }}>
        <Ionicons name="lock-closed-outline" size={42} color={theme.textMuted} />
        <Text className="mt-4 text-center text-[16px] font-semibold" style={{ color: theme.text }}>
          You do not have permission to access Inventory.
        </Text>
        <TouchableOpacity onPress={onBack} className="mt-5 rounded-xl px-5 py-3" style={{ backgroundColor: theme.primary }}>
          <Text className="font-semibold text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <View
        className="flex-row items-center pb-3"
        style={[screenContentStyle, { paddingTop: headerTopPadding }]}>
        <TouchableOpacity onPress={onBack} className="mr-3 -ml-2 h-10 w-8 items-center justify-center">
          <Ionicons name="caret-back-outline" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text className="text-[28px] font-bold" style={{ color: theme.primary }}>Inventory</Text>
      </View>

      <View className="pb-3" style={screenContentStyle}>
        <View className="mb-2 flex-row rounded-full border p-1" style={{ backgroundColor: theme.input, borderColor: theme.border }}>
          <TouchableOpacity
            className="flex-1 rounded-full py-2"
            style={{ backgroundColor: activeTab === 'items' ? theme.primary : 'transparent' }}
            onPress={() => setActiveTab('items')}>
            <Text className="text-center font-semibold" style={{ color: activeTab === 'items' ? '#FFFFFF' : theme.textSecondary }}>Items</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 rounded-full py-2"
            style={{ backgroundColor: activeTab === 'logs' ? theme.primary : 'transparent' }}
            onPress={() => setActiveTab('logs')}>
            <Text className="text-center font-semibold" style={{ color: activeTab === 'logs' ? '#FFFFFF' : theme.textSecondary }}>Logs</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-2 flex-row items-center rounded-xl border px-3" style={{ backgroundColor: theme.input, borderColor: theme.border }}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={activeTab === 'items' ? 'Search item name...' : 'Search log item...'}
            placeholderTextColor={theme.textMuted}
            className="ml-2 h-11 flex-1 text-[14px]"
            style={{ color: theme.text }}
          />
        </View>

        {activeTab === 'items' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                className="mr-2 rounded-full border px-4 py-2"
                style={{ backgroundColor: selectedCategory === cat ? theme.primary : theme.surface, borderColor: selectedCategory === cat ? theme.primary : theme.border }}>
                <Text className="text-[12px] font-semibold" style={{ color: selectedCategory === cat ? '#FFFFFF' : theme.textSecondary }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View className="mb-1">
            <Text className="mb-1 text-[12px] font-semibold" style={{ color: theme.textMuted }}>Log Type</Text>
            <TouchableOpacity
              onPress={() => setShowLogTypePicker((prev) => !prev)}
              className="h-11 flex-row items-center justify-between rounded-xl border px-3"
              style={{ backgroundColor: theme.input, borderColor: theme.border }}>
              <Text className="text-[14px] font-semibold" style={{ color: theme.text }}>
                {actionFilterLabels[selectedAction]}
              </Text>
              <Ionicons name={showLogTypePicker ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
            </TouchableOpacity>
            {showLogTypePicker && (
              <View className="mt-2 overflow-hidden rounded-xl border" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                {actionTypes.map((action) => (
                  <TouchableOpacity
                    key={action}
                    onPress={() => {
                      setSelectedAction(action);
                      setShowLogTypePicker(false);
                    }}
                    className="border-b px-4 py-3"
                    style={{ borderBottomColor: theme.border }}>
                    <Text className="text-[13px] font-semibold" style={{ color: selectedAction === action ? theme.primary : theme.text }}>
                      {actionFilterLabels[action]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {canAdd && activeTab === 'items' && (
        <View style={screenContentStyle}>
          <TouchableOpacity onPress={() => setShowAdd(true)} className="mb-3 h-[48px] items-center justify-center rounded-[12px]" style={{ backgroundColor: theme.primary }}>
            <Text className="text-[15px] font-bold text-white">Add Inventory Item</Text>
          </TouchableOpacity>
        </View>
      )}
      {canEdit && activeTab === 'logs' && (
        <View style={screenContentStyle}>
          <TouchableOpacity onPress={() => setShowAddLog(true)} className="mb-3 h-[44px] items-center justify-center rounded-[12px]" style={{ backgroundColor: theme.primaryPressed }}>
            <Text className="text-[14px] font-bold text-white">Add Log Entry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + (showBottomNav ? 150 : 110), 130) }}>
          <View style={screenContentStyle}>
          {activeTab === 'items'
            ? Array.from({ length: 5 }).map((_, index) => <InventoryItemSkeleton key={index} />)
            : Array.from({ length: 4 }).map((_, index) => <InventoryLogSkeleton key={index} />)}
          </View>
        </ScrollView>
      ) : error ? (
        <View className="mt-12 items-center px-8">
          <Ionicons name="alert-circle-outline" size={40} color={theme.danger} />
          <Text className="mt-3 text-center" style={{ color: theme.textSecondary }}>{error}</Text>
          <TouchableOpacity onPress={() => load()} className="mt-4 rounded-lg px-4 py-2" style={{ backgroundColor: theme.primary }}>
            <Text className="font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + (showBottomNav ? 150 : 110), 130) }}>
          <View style={screenContentStyle}>
          <TouchableOpacity onPress={refresh} className="mb-2 self-end rounded-md px-3 py-1" style={{ backgroundColor: theme.primaryLight }}>
            <Text className="text-[12px]" style={{ color: theme.primary }}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
          </TouchableOpacity>

          {activeTab === 'items' &&
            (filteredItems.length === 0 ? (
              <View className="mt-14 items-center">
                <Ionicons name="cube-outline" size={38} color={theme.textMuted} />
                <Text className="mt-2" style={{ color: theme.textMuted }}>No inventory items found.</Text>
              </View>
            ) : (
              filteredItems.map((item) => {
                const status = stockStatus(item.quantity, item.critical_level);
                const isHighlighted = String(item.id) === String(highlightItemId);
                return (
                  <TouchableOpacity
                    key={item.id}
                    className="mb-3 rounded-2xl border p-4"
                    style={{
                      backgroundColor: isHighlighted ? theme.primaryLight : theme.surface,
                      borderColor: isHighlighted ? theme.warning : theme.border,
                      shadowColor: theme.shadow,
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                    onPress={() => {
                      if (!canEdit) return;
                      Alert.alert(item.item_name, 'Choose action', [
                        { text: 'Record Transaction', onPress: () => { setTxnItem(item); setTxnAction('RECEIVING'); setTxnQty(''); setTxnNotes(''); setTxnTaskId(''); setShowTransaction(true); } },
                        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item.id) },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}>
                    <View className="mb-2 flex-row items-start justify-between">
                      <Text className="mr-2 flex-1 text-[16px] font-bold" style={{ color: theme.text }} numberOfLines={2}>{item.item_name}</Text>
                      <View className="rounded-full px-2 py-1" style={{ backgroundColor: status.bg }}>
                        <Text className="text-[10px] font-semibold text-white">{status.label}</Text>
                      </View>
                    </View>
                    <Text className="text-[12px]" style={{ color: theme.textMuted }}>{item.category}</Text>
                    <View className="mt-2 flex-row justify-between">
                      <Text className="text-[13px]" style={{ color: theme.textSecondary }}>Qty: <Text className="font-semibold">{item.quantity} {item.unit || 'pcs'}</Text></Text>
                      <Text className="text-[13px]" style={{ color: theme.textSecondary }}>Critical: <Text className="font-semibold">{item.critical_level}</Text></Text>
                    </View>
                    <Text className="mt-1 text-[13px]" style={{ color: theme.textSecondary }}>Price: <Text className="font-semibold">PHP {item.price}</Text></Text>
                  </TouchableOpacity>
                );
              })
            ))}

          {activeTab === 'logs' &&
            (filteredLogs.length === 0 ? (
              <View className="mt-14 items-center">
                <Ionicons name="document-text-outline" size={38} color={theme.textMuted} />
                <Text className="mt-2" style={{ color: theme.textMuted }}>
                  {selectedAction === 'all'
                    ? 'No inventory logs yet.'
                    : `No inventory logs for ${actionFilterLabels[selectedAction]}.`}
                </Text>
              </View>
            ) : (
              <View className="ml-2">
                {filteredLogs.map((log, idx) => {
                  const type = (log.action_type || '').toLowerCase();
                  let meta = { icon: 'receipt-outline', color: '#7370FF', bg: '#F0EFFF', prefix: '' };
                  
                  if (type.includes('receiving') || type.includes('add')) {
                    meta = { icon: 'download-outline', color: '#5DBF50', bg: '#E8F5E9', prefix: '+' };
                  } else if (type.includes('consumption') || type.includes('consume')) {
                    meta = { icon: 'exit-outline', color: '#FF9F43', bg: '#FFF3E0', prefix: '-' };
                  } else if (type.includes('spoilage') || type.includes('delete')) {
                    meta = { icon: 'trash-outline', color: '#FF6B6B', bg: '#FFEBEE', prefix: '-' };
                  } else if (type.includes('return')) {
                    meta = { icon: 'refresh-outline', color: '#4dabf7', bg: '#e7f5ff', prefix: '+' };
                  }

                  return (
                    <View key={log.id} className="flex-row">
                      {/* Timeline column */}
                      <View className="mr-4 items-center">
                        <View 
                          className="h-10 w-10 items-center justify-center rounded-full" 
                          style={{ backgroundColor: meta.bg }}
                        >
                          <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                        </View>
                        {idx !== filteredLogs.length - 1 && (
                          <View className="w-[2px] flex-1" style={{ backgroundColor: theme.border }} />
                        )}
                      </View>

                      {/* Content column */}
                      <View className="flex-1 pb-8">
                        <View 
                          className="rounded-2xl p-4" 
                          style={{ backgroundColor: theme.surface, shadowColor: theme.shadow, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 }}
                        >
                          <View className="mb-2 flex-row items-center justify-between">
                            <Text className="flex-1 text-[16px] font-bold" style={{ color: theme.text }} numberOfLines={1}>
                              {log.item_name}
                            </Text>
                            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: meta.bg }}>
                              <Text className="text-[10px] font-bold" style={{ color: meta.color }}>
                                {meta.prefix}{log.quantity} {log.unit || 'pcs'}
                              </Text>
                            </View>
                          </View>

                          <View className="mb-3 space-y-2">
                            <View className="mb-1 min-w-0 flex-1 flex-row items-center pr-2">
                              <Ionicons name="business-outline" size={14} color={theme.primary} />
                              <Text className="ml-2 flex-1 text-[12px]" style={{ color: theme.textSecondary }}>
                                <Text className="font-semibold" style={{ color: theme.text }}>Project: </Text>
                                {log.project_name || 'N/A'}
                              </Text>
                            </View>
                            <View className="flex-row items-center">
                              <Ionicons name="location-outline" size={14} color={theme.primary} />
                              <Text className="ml-2 flex-1 text-[12px]" style={{ color: theme.textSecondary }}>
                                <Text className="font-semibold" style={{ color: theme.text }}>Location: </Text>
                                {log.location || 'N/A'}
                              </Text>
                            </View>
                            <View className="flex-row items-center">
                              <Ionicons name="person-outline" size={14} color={theme.primary} />
                              <Text className="ml-2 text-[12px]" style={{ color: theme.textSecondary }}>
                                <Text className="font-semibold" style={{ color: theme.text }}>By: </Text>
                                {log.actor_name || 'Unknown'}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row flex-wrap items-center justify-between border-t pt-3" style={{ borderColor: theme.border }}>
                            <View className="flex-row items-center">
                              <Ionicons name="calendar-outline" size={12} color={theme.textMuted} />
                              <Text className="ml-1 flex-1 text-[11px] font-medium" style={{ color: theme.textMuted }} numberOfLines={2}>
                                {new Date(log.created_at).toLocaleDateString()} • {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <View className="mb-1 rounded-md px-2 py-1" style={{ backgroundColor: theme.input }}>
                              <Text className="text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }} numberOfLines={1}>
                                {ACTION_LABELS[log.action_type] || actionFilterLabels[log.action_type] || log.action_type}
                              </Text>
                            </View>
                          </View>

                          {!!log.notes && (
                            <View className="mt-3 rounded-lg border-l-2 p-2" style={{ backgroundColor: theme.input, borderColor: theme.border }}>
                              <Text className="text-[11px] italic" style={{ color: theme.textSecondary }}>"{log.notes}"</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
        <Modal visible={showAdd} transparent animationType="slide" onRequestClose={closeAddItemModal}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center px-6" style={{ backgroundColor: theme.overlay }}>
            <TouchableOpacity activeOpacity={1} onPress={closeAddItemModal} className="absolute inset-0" />
            <TouchableWithoutFeedback>
              <View className="max-h-[86%] w-full rounded-3xl" style={{ backgroundColor: theme.elevated, maxWidth: 560, alignSelf: 'center' }}>
                <View className="flex-row items-center justify-between border-b px-6 py-4" style={{ borderColor: theme.border }}>
                  <Text className="text-[18px] font-bold" style={{ color: theme.primary }}>Add Inventory Item</Text>
                  <TouchableOpacity onPress={closeAddItemModal} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: theme.input }}>
                    <Ionicons name="close" size={20} color={theme.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView className="px-6 pt-5" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
                  <Text className="mb-1 text-[12px] font-semibold" style={{ color: theme.textSecondary }}>Item Name</Text>
                  <TextInput value={addName} onChangeText={setAddName} style={inputStyle} placeholder="Enter the title of the item here" placeholderTextColor={theme.textMuted} />
                  <Text className="mb-1 text-[12px] font-semibold" style={{ color: theme.textSecondary }}>Category</Text>
                  <View className="mb-3 flex-row flex-wrap">
                    {itemCategories.map((category) => (
                      <TouchableOpacity
                        key={category}
                        onPress={() => setAddCategory(category)}
                        className="mb-2 mr-2 rounded-full border px-3 py-2"
                        style={{
                          backgroundColor: addCategory === category ? theme.primaryLight : theme.input,
                          borderColor: addCategory === category ? theme.primary : theme.border,
                        }}>
                        <Text className="text-[12px] font-semibold" style={{ color: addCategory === category ? theme.primary : theme.textSecondary }}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text className="mb-1 text-[12px] font-semibold" style={{ color: theme.textSecondary }}>Minimum Stock</Text>
                  <TextInput value={addCritical} onChangeText={setAddCritical} style={inputStyle} placeholder="e.g. 5" keyboardType="numeric" placeholderTextColor={theme.textMuted} />
                  <Text className="mb-1 text-[12px] font-semibold" style={{ color: theme.textSecondary }}>Price</Text>
                  <TextInput value={addPrice} onChangeText={setAddPrice} style={inputStyle} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={theme.textMuted} />
                </ScrollView>
                <View className="border-t px-6 pb-6 pt-4" style={{ borderColor: theme.border }}>
                  <TouchableOpacity onPress={handleAdd} disabled={saving} className="h-12 items-center justify-center rounded-xl" style={{ backgroundColor: theme.primary }}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save Item</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={showTransaction} transparent animationType="slide" onRequestClose={closeTransactionModal}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center px-6" style={{ backgroundColor: theme.overlay }}>
            <TouchableOpacity activeOpacity={1} onPress={closeTransactionModal} className="absolute inset-0" />
            <TouchableWithoutFeedback>
            <View className="max-h-[86%] w-full rounded-3xl p-6" style={{ backgroundColor: theme.elevated, maxWidth: 560, alignSelf: 'center' }}>
              <View className="mb-4 flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-[18px] font-bold" style={{ color: theme.primary }}>Record Transaction</Text>
                  <Text className="mt-2 rounded-xl border px-3 py-2 text-[12px] leading-5" style={{ color: theme.textMuted, backgroundColor: theme.input, borderColor: theme.border }}>
                    Inventory logs are permanent once saved and cannot be edited. Please review everything before confirming.
                  </Text>
                </View>
                <TouchableOpacity onPress={closeTransactionModal} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: theme.input }}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              <Text className="mb-3 text-center text-[13px]" style={{ color: theme.textSecondary }}>{txnItem?.item_name}</Text>
              <Text className="mb-1 text-[12px]" style={{ color: theme.textSecondary }}>Action Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                {MOBILE_ACTION_TYPES.map((a) => (
                  <TouchableOpacity key={a} onPress={() => { setTxnAction(a); if (a !== 'CONSUMPTION') setTxnTaskId(''); }}
                    className="mr-2 rounded-full px-3 py-2"
                    style={{ backgroundColor: txnAction === a ? theme.primaryLight : theme.input }}>
                    <Text className="text-[12px] font-semibold" style={{ color: txnAction === a ? theme.primary : theme.textSecondary }}>{ACTION_TYPE_LABELS[a]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput value={txnQty} onChangeText={setTxnQty} style={inputStyle} keyboardType="numeric" placeholder="Quantity (must be > 0)" placeholderTextColor={theme.textMuted} />
              {txnAction === 'CONSUMPTION' && (
                <View className="mb-3">
                  <Text className="mb-1 text-[12px] font-semibold" style={{ color: theme.warning }}>⚠ Task Required for Consumption</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {projectTasks.map((t) => (
                      <TouchableOpacity key={t.id} onPress={() => setTxnTaskId(String(t.id))}
                        className="mr-2 rounded-full px-3 py-2"
                        style={{ backgroundColor: txnTaskId === String(t.id) ? theme.primaryLight : theme.input }}>
                        <Text className="text-[12px]" style={{ color: txnTaskId === String(t.id) ? theme.primary : theme.textSecondary }}>{t.title}</Text>
                      </TouchableOpacity>
                    ))}
                    {projectTasks.length === 0 && <Text className="text-[12px]" style={{ color: theme.textMuted }}>No tasks found for this project.</Text>}
                  </ScrollView>
                </View>
              )}
              <TextInput value={txnNotes} onChangeText={setTxnNotes} style={inputStyle} placeholder="Notes (optional)" placeholderTextColor={theme.textMuted} />
              <TouchableOpacity onPress={handleTransaction} disabled={saving} className="mt-2 h-12 items-center justify-center rounded-xl" style={{ backgroundColor: ACTION_TYPE_COLORS[txnAction] }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Submit {ACTION_TYPE_LABELS[txnAction]}</Text>}
              </TouchableOpacity>
            </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={showAddLog} transparent animationType="fade" onRequestClose={closeAddLogModal}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 items-center justify-center px-6" style={{ backgroundColor: theme.overlay }}>
            <TouchableOpacity activeOpacity={1} onPress={closeAddLogModal} className="absolute inset-0" />
            <TouchableWithoutFeedback>
            <View className="max-h-[86%] w-full rounded-3xl p-6" style={{ backgroundColor: theme.elevated, maxWidth: 560, alignSelf: 'center' }}>
              <View className="mb-4 flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-[18px] font-bold" style={{ color: theme.primary }}>Add Inventory Log</Text>
                  <Text className="mt-2 rounded-xl border px-3 py-2 text-[12px] leading-5" style={{ color: theme.textMuted, backgroundColor: theme.input, borderColor: theme.border }}>
                    Inventory logs are permanent once saved and cannot be edited. Please review everything before confirming.
                  </Text>
                </View>
                <TouchableOpacity onPress={closeAddLogModal} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: theme.input }}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
              <Text className="mb-1 text-[12px]" style={{ color: theme.textSecondary }}>Item</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setLogItemId(String(item.id))}
                    className="mr-2 rounded-full px-3 py-2"
                    style={{ backgroundColor: logItemId === String(item.id) ? theme.primaryLight : theme.input }}>
                    <Text style={{ color: logItemId === String(item.id) ? theme.primary : theme.textSecondary }}>{item.item_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text className="mb-1 text-[12px]" style={{ color: theme.textSecondary }}>Action Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                {MOBILE_ACTION_TYPES.map((action) => (
                  <TouchableOpacity
                    key={action}
                    onPress={() => { setLogActionType(action); if (action !== 'CONSUMPTION') setLogTaskId(''); }}
                    className="mr-2 rounded-full px-3 py-2"
                    style={{ backgroundColor: logActionType === action ? theme.primaryLight : theme.input }}>
                    <Text className="text-[12px]" style={{ color: logActionType === action ? theme.primary : theme.textSecondary }}>{ACTION_TYPE_LABELS[action]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {logActionType === 'CONSUMPTION' && (
                <View className="mb-2">
                  <Text className="mb-1 text-[12px] font-semibold" style={{ color: theme.warning }}>⚠ Select Task</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {projectTasks.map((t) => (
                      <TouchableOpacity key={t.id} onPress={() => setLogTaskId(String(t.id))}
                        className="mr-2 rounded-full px-3 py-2"
                        style={{ backgroundColor: logTaskId === String(t.id) ? theme.primaryLight : theme.input }}>
                        <Text className="text-[12px]" style={{ color: logTaskId === String(t.id) ? theme.primary : theme.textSecondary }}>{t.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              <TextInput value={logQty} onChangeText={setLogQty} style={inputStyle} keyboardType="numeric" placeholder="Quantity" placeholderTextColor={theme.textMuted} />
              <TextInput value={logNotes} onChangeText={setLogNotes} style={inputStyle} placeholder="Remarks / notes" placeholderTextColor={theme.textMuted} />
              </ScrollView>
              <TouchableOpacity onPress={handleAddLog} disabled={saving} className="h-12 items-center justify-center rounded-xl" style={{ backgroundColor: theme.primary }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Review & Save Log</Text>}
              </TouchableOpacity>
            </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
        <Modal visible={successModal !== null} transparent animationType="fade">
          <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
            <View className="w-full rounded-[24px] p-6" style={{ backgroundColor: theme.elevated, maxWidth: 420 }}>
              <View className="mb-4 h-16 w-16 items-center justify-center self-center rounded-full" style={{ backgroundColor: theme.primary }}>
                <Ionicons name="checkmark" size={34} color="white" />
              </View>
              <Text className="text-center text-[20px] font-bold" style={{ color: theme.text }}>
                {successModal === 'item' ? 'Item added!' : 'Log added!'}
              </Text>
              <Text className="mt-2 text-center text-[14px] leading-5" style={{ color: theme.textMuted }}>
                {successModal === 'item'
                  ? "Item is now visible in this project's inventory."
                  : 'Inventory log has been recorded successfully.'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const target = successModal;
                  setSuccessModal(null);
                  setActiveTab(target === 'item' ? 'items' : 'logs');
                }}
                className="mt-6 h-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: theme.primary }}>
                <Text className="text-[14px] font-bold text-white">
                  {successModal === 'item' ? 'Back to Inventory' : 'Back to Logs'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      {showBottomNav && onNavigate && (
        <BottomNavigationBar
          activeTab={activeMainTab}
          onTabPress={onNavigate}
          canViewHome={canViewHome}
          unreadCount={unreadCount}
        />
      )}
    </View>
  );
}
