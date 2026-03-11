import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import ExerciseListScreen from './screens/ExerciseListScreen';
import CameraPoseScreen from './screens/CameraPoseScreen';

export default function App() {
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);

  // Android 返回键：在相机界面时返回列表界面
  useEffect(() => {
    const onBackPress = () => {
      if (selectedExerciseId) {
        setSelectedExerciseId(null);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [selectedExerciseId]);

  if (!selectedExerciseId) {
    return <ExerciseListScreen onSelectExercise={setSelectedExerciseId} />;
  }

  return <CameraPoseScreen exerciseId={selectedExerciseId} />;
}
