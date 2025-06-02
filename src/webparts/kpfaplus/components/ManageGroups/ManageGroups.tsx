// src/webparts/kpfaplus/components/ManageGroups/ManageGroups.tsx
import * as React from 'react';
import { ITabProps } from '../../models/types';
import { PrimaryButton } from '@fluentui/react/lib/Button';
import { Stack } from '@fluentui/react/lib/Stack';

export interface IManageGroupsProps extends ITabProps {
  onGoBack: () => void;
}

export const ManageGroups: React.FC<IManageGroupsProps> = (props) => {
  const { onGoBack, context, currentUserId } = props;

  return (
    <div style={{ 
      padding: '20px', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Header with Back button */}
      <div style={{ 
        marginBottom: '20px', 
        borderBottom: '1px solid #e0e0e0', 
        paddingBottom: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
          Manage Groups
        </h2>
        <PrimaryButton
          text="Go Back"
          iconProps={{ iconName: 'Back' }}
          onClick={onGoBack}
          styles={{
            root: {
              backgroundColor: '#0078d4',
              border: 'none'
            }
          }}
        />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Stack tokens={{ childrenGap: 20 }}>
          {/* Current user info */}
          {currentUserId && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#f9f9f9', 
              borderRadius: '4px',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                Current User Information
              </h3>
              <div>
                <strong>User ID:</strong> {currentUserId}
              </div>
            </div>
          )}

          {/* Placeholder for future functionality */}
          <div style={{ 
            padding: '20px', 
            backgroundColor: '#fff', 
            border: '2px dashed #c8c6c4',
            borderRadius: '4px',
            textAlign: 'center' as const
          }}>
            <h3 style={{ color: '#666', marginBottom: '10px' }}>
              Groups Management Interface
            </h3>
            <p style={{ color: '#888', margin: 0 }}>
              This is where the groups management functionality will be implemented.
              <br />
              Features to include:
              <br />
              • Create new groups
              <br />
              • Edit existing groups
              <br />
              • Delete groups
              <br />
              • Manage group permissions
              <br />
              • Assign users to groups
            </p>
          </div>

          {/* Debug information */}
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '4px',
            fontSize: '12px',
            color: '#666'
          }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Debug Information:</h4>
            <div>Context available: {context ? 'Yes' : 'No'}</div>
            <div>Current User ID: {currentUserId || 'Not available'}</div>
            <div>Component rendered at: {new Date().toLocaleTimeString()}</div>
          </div>
        </Stack>
      </div>
    </div>
  );
};