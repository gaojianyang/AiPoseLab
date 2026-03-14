import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Camera } from 'react-native-vision-camera';
import { ALL_EXERCISES } from '../exercises';

export interface ExerciseListScreenProps {
  onSelectExercise: (exerciseId: string) => void;
  onOpenSkinList?: () => void;
}

export default function ExerciseListScreen({ onSelectExercise, onOpenSkinList }: ExerciseListScreenProps) {
  // 进入列表时预加载相机模块，减少进入相机页时“正在初始化相机设备...”卡住
  useEffect(() => {
    Camera.getAvailableCameraDevices();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>选择动作</Text>
        <TouchableOpacity style={styles.toolbarBtn} onPress={onOpenSkinList}>
          <Text style={styles.toolbarBtnText}>皮肤</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={ALL_EXERCISES}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.exerciseRow}
        contentContainerStyle={styles.exerciseListContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.exerciseCard}
            onPress={() => onSelectExercise(item.id)}
          >
            <View style={styles.exerciseCardInner}>
              <Text style={styles.exerciseTitle}>{item.name}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  toolbar: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  toolbarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  toolbarBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  exerciseListContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  exerciseRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  exerciseCard: {
    flex: 1,
    marginHorizontal: 4,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    overflow: 'hidden',
  },
  exerciseCardInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  exerciseTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});
