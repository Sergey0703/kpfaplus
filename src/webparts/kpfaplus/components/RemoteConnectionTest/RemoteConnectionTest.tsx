// src/webparts/kpfaplus/components/RemoteConnectionTest/RemoteConnectionTest.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SpinnerSize, Spinner, MessageBar, MessageBarType, PrimaryButton } from '@fluentui/react';
import { RemoteSiteService, IRemoteSiteInfo, IRemoteListInfo } from '../../services';

export interface IRemoteConnectionTestProps {
  context: WebPartContext;
}

export const RemoteConnectionTest: React.FC<IRemoteConnectionTestProps> = (props) => {
  const { context } = props;
  
  // Состояния компонента
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [siteInfo, setSiteInfo] = useState<IRemoteSiteInfo | null>(null);
  const [listsInfo, setListsInfo] = useState<{ [listName: string]: IRemoteListInfo | { error: string } } | null>(null);
  
  // Функция для проверки соединения с удаленным сайтом
  const testConnection = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setSiteInfo(null);
    setListsInfo(null);
    
    try {
      // Получаем экземпляр RemoteSiteService
      const remoteSiteService = RemoteSiteService.getInstance(context);
      
      // Проверяем подключение к удаленному сайту
      const siteInfoResult = await remoteSiteService.testRemoteSiteConnection();
      setSiteInfo(siteInfoResult);
      
      // Проверяем наличие необходимых списков
      const listsInfoResult = await remoteSiteService.checkAllRequiredLists();
      setListsInfo(listsInfoResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Вызываем проверку соединения при монтировании компонента
  useEffect(() => {
    testConnection();
  }, []);
  
  return (
    <div>
      <h2>Remote Site Connection Test</h2>
      
      {isLoading && (
        <div style={{ marginBottom: '20px' }}>
          <Spinner size={SpinnerSize.large} label="Testing connection to remote site..." />
        </div>
      )}
      
      {error && (
        <div style={{ marginBottom: '20px' }}>
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={true}
          >
            Error connecting to remote site: {error}
          </MessageBar>
        </div>
      )}
      
      {siteInfo && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Remote Site Information</h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px', border: '1px solid #ddd' }}>Site Title</td>
                <td style={{ padding: '4px', border: '1px solid #ddd' }}>{siteInfo.title}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px', border: '1px solid #ddd' }}>URL</td>
                <td style={{ padding: '4px', border: '1px solid #ddd' }}>{siteInfo.url}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px', border: '1px solid #ddd' }}>ID</td>
                <td style={{ padding: '4px', border: '1px solid #ddd' }}>{siteInfo.id}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px', border: '1px solid #ddd' }}>Created</td>
                <td style={{ padding: '4px', border: '1px solid #ddd' }}>{siteInfo.created}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '4px', border: '1px solid #ddd' }}>Last Modified</td>
                <td style={{ padding: '4px', border: '1px solid #ddd' }}>{siteInfo.lastModifiedDateTime}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      
      {listsInfo && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Required Lists Status</h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'left' }}>List Name</th>
                <th style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'left' }}>Items Count</th>
                <th style={{ padding: '4px', border: '1px solid #ddd', textAlign: 'left' }}>Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(listsInfo).map(([listName, info]) => (
                <tr key={listName}>
                  <td style={{ padding: '4px', border: '1px solid #ddd' }}>{listName}</td>
                  <td style={{ padding: '4px', border: '1px solid #ddd' }}>
                    {'error' in info ? (
                      <span style={{ color: 'red' }}>Error: {info.error}</span>
                    ) : (
                      <span style={{ color: 'green' }}>Available</span>
                    )}
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #ddd' }}>
                    {'error' in info ? '-' : info.itemCount}
                  </td>
                  <td style={{ padding: '4px', border: '1px solid #ddd' }}>
                    {'error' in info ? '-' : (info.lastModifiedDateTime || '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <PrimaryButton
          text="Test Connection Again"
          onClick={testConnection}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};