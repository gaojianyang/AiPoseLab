import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import ExerciseListScreen from './screens/ExerciseListScreen';
import CameraPoseScreen from './screens/CameraPoseScreen';
import SynthesisScreen from './screens/SynthesisScreen';
import SkinScreenList from './screens/SkinScreenList';
import { setCurrentSkin } from './skinStore';

export default function App() {
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [synthesisParams, setSynthesisParams] = useState(null);
  const [showSkinList, setShowSkinList] = useState(false);

  useEffect(() => {
    const onBackPress = () => {
      if (showSkinList) {
        setShowSkinList(false);
        return true;
      }
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

  if (showSkinList) {
    return (
      <SkinScreenList
        onBack={() => setShowSkinList(false)}
        onSelectSkin={(skin) => {
          setCurrentSkin(skin);
          setShowSkinList(false);
        }}
      />
    );
  }

  if (!selectedExerciseId) {
    return (
      <ExerciseListScreen
        onSelectExercise={setSelectedExerciseId}
        onOpenSkinList={() => setShowSkinList(true)}
      />
    );
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
