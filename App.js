import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import ExerciseListScreen from './screens/ExerciseListScreen';
import CameraPoseScreen from './screens/CameraPoseScreen';
import SynthesisScreen from './screens/SynthesisScreen';

export default function App() {
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [synthesisParams, setSynthesisParams] = useState(null);

  useEffect(() => {
    const onBackPress = () => {
      if (synthesisParams) {
        setSynthesisParams(null);
        return true;
      }
      if (selectedExerciseId) {
        setSelectedExerciseId(null);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [selectedExerciseId, synthesisParams]);

  if (!selectedExerciseId) {
    return <ExerciseListScreen onSelectExercise={setSelectedExerciseId} />;
  }

  if (synthesisParams) {
    return (
      <SynthesisScreen
        videoPath={synthesisParams.videoPath}
        posePath={synthesisParams.posePath}
        onBack={() => setSynthesisParams(null)}
      />
    );
  }

  return (
    <CameraPoseScreen
      exerciseId={selectedExerciseId}
      onRequestSynthesis={(videoPath, posePath) =>
        setSynthesisParams({ videoPath, posePath })
      }
    />
  );
}
