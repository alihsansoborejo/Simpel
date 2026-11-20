import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export interface WorkspaceSelection {
  subjectId?: string | null;
  classId?: string | null;
  classLevel?: number | null;
  assignmentId?: string | null;
}

interface WorkspaceContextType {
  selectedSubjectId: string | null;
  selectedClassId: string | null;
  selectedClassLevel: number | null;
  selectedAssignmentId: string | null;
  setWorkspaceSelection: (selection: WorkspaceSelection) => void;
  clearWorkspaceSelection: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassLevel, setSelectedClassLevel] = useState<number | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Reset pilihan mapel/kelas ketika pengguna berganti
  useEffect(() => {
    setSelectedSubjectId(null);
    setSelectedClassId(null);
    setSelectedClassLevel(null);
    setSelectedAssignmentId(null);
  }, [user?.id]);

  const setWorkspaceSelection = (selection: WorkspaceSelection) => {
    if (selection.subjectId !== undefined) setSelectedSubjectId(selection.subjectId);
    if (selection.classId !== undefined) setSelectedClassId(selection.classId);
    if (selection.classLevel !== undefined) setSelectedClassLevel(selection.classLevel);
    if (selection.assignmentId !== undefined) setSelectedAssignmentId(selection.assignmentId);
  };

  const clearWorkspaceSelection = () => {
    setSelectedSubjectId(null);
    setSelectedClassId(null);
    setSelectedClassLevel(null);
    setSelectedAssignmentId(null);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        selectedSubjectId,
        selectedClassId,
        selectedClassLevel,
        selectedAssignmentId,
        setWorkspaceSelection,
        clearWorkspaceSelection,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace harus digunakan di dalam WorkspaceProvider');
  }
  return context;
};
