// src/webparts/kpfaplus/components/RemoteConnectionTest/RemoteConnectionTest.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { PrimaryButton, DefaultButton, Stack, StackItem, MessageBar, MessageBarType, Spinner, SpinnerSize, Label, TextField, Toggle } from '@fluentui/react';
import { RemoteSiteService, IRemoteSiteInfo, IRemoteListInfo } from '../../services/RemoteSiteService';
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IRemoteConnectionTestProps {
  context: WebPartContext;
}

export const RemoteConnectionTest: React.FC<IRemoteConnectionTestProps> = (props) => {
  const { context } = props;
  
  // Состояния компонента
  const [remoteSiteUrl, setRemoteSiteUrl] = useState<string>("");
  const [siteInfo, setSiteInfo] = useState<IRemoteSiteInfo | null>(null);
  const [listsInfo, setListsInfo] = useState<{ [listName: string]: IRemoteListInfo | { error: string } } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showLists, setShowLists] = useState<boolean>(false);
  
  // Инициализация сервиса
  const remoteSiteService = React.useMemo(() => RemoteSiteService.getInstance(context), [context]);
  
  // Загрузка URL удаленного сайта при инициализации
  useEffect(() => {
    setRemoteSiteUrl(remoteSiteService.getRemoteSiteUrl());
  }, [remoteSiteService]);
  
  // Обработчики событий
  const handleTestConnection = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setSiteInfo(null);
    setListsInfo(null);
    
    try {
      const info = await remoteSiteService.testRemoteSiteConnection();
      setSiteInfo(info);
      console.log("Remote site connection successful:", info);
    } catch (err) {
      console.error("Error testing connection:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCheckLists = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setListsInfo(null);
    
    try {
      const results = await remoteSiteService.checkAllRequiredLists();
      setListsInfo(results);
      console.log("Remote lists check results:", results);
    } catch (err) {
      console.error("Error checking lists:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div style={{ padding: '15px' }}>
      <h2>Remote Site Connection Test</h2>
      
      <Stack tokens={{ childrenGap: 15 }}>
        {/* URL удаленного сайта */}
        <StackItem>
          <Label>Remote Site URL:</Label>
          <TextField 
            value={remoteSiteUrl} 
            readOnly 
            styles={{ root: { maxWidth: '600px' } }}
          />
        </StackItem>
        
        {/* Кнопки для тестирования */}
        <StackItem>
          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <PrimaryButton 
              text="Test Connection" 
              onClick={handleTestConnection}
              disabled={isLoading}
            />
            <DefaultButton 
              text="Check Lists" 
              onClick={handleCheckLists}
              disabled={isLoading || !siteInfo}
            />
          </Stack>
        </StackItem>
        
        {/* Индикатор загрузки */}
        {isLoading && (
          <StackItem>
            <Spinner 
              label="Processing request..." 
              size={SpinnerSize.medium} 
            />
          </StackItem>
        )}
        
        {/* Сообщение об ошибке */}
        {error && (
          <StackItem>
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={true}
              dismissButtonAriaLabel="Close"
            >
              {error}
            </MessageBar>
          </StackItem>
        )}
        
        {/* Результаты по сайту */}
        {siteInfo && (
          <StackItem>
            <MessageBar
              messageBarType={MessageBarType.success}
              isMultiline={true}
            >
              Connected to remote site: {siteInfo.title}
            </MessageBar>
            
            <Toggle
              label="Show Site Details"
              checked={showLists}
              onChange={(_, checked) => setShowLists(!!checked)}
              styles={{ root: { marginTop: '10px' } }}
            />
            
            {showLists && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f8f8', borderRadius: '4px' }}>
                <h3>Site Information</h3>
                <p><strong>ID:</strong> {siteInfo.id}</p>
                <p><strong>Title:</strong> {siteInfo.title}</p>
                <p><strong>URL:</strong> {siteInfo.url}</p>
                <p><strong>Created:</strong> {new Date(siteInfo.created).toLocaleString()}</p>
                <p><strong>Last Modified:</strong> {new Date(siteInfo.lastModifiedDateTime).toLocaleString()}</p>
                {siteInfo.description && <p><strong>Description:</strong> {siteInfo.description}</p>}
              </div>
            )}
          </StackItem>
        )}
        
        {/* Результаты по спискам */}
        {listsInfo && (
          <StackItem>
            <h3>Lists Information</h3>
            
            {Object.entries(listsInfo).map(([listName, info]) => (
              <div 
                key={listName}
                style={{ 
                  marginBottom: '10px', 
                  padding: '10px', 
                  backgroundColor: 'error' in info ? '#fdeeee' : '#eef7ee',
                  borderRadius: '4px'
                }}
              >
                <h4>{listName}</h4>
                
                {'error' in info ? (
                  <MessageBar messageBarType={MessageBarType.error}>
                    {info.error}
                  </MessageBar>
                ) : (
                  <div>
                    <p><strong>ID:</strong> {info.id}</p>
                    <p><strong>Title:</strong> {info.title}</p>
                    <p><strong>Item Count:</strong> {info.itemCount}</p>
                    {info.description && <p><strong>Description:</strong> {info.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </StackItem>
        )}
      </Stack>
    </div>
  );
};