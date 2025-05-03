import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

// Локализационные строки
const strings = {
  PropertyPaneDescription: "Description",
  BasicGroupName: "Group Name",
  DescriptionFieldLabel: "Description Field",
  AppLocalEnvironmentSharePoint: "The app is running on a local environment as SharePoint web part",
  AppLocalEnvironmentTeams: "The app is running on a local environment as Microsoft Teams app",
  AppSharePointEnvironment: "The app is running on SharePoint page",
  AppTeamsTabEnvironment: "The app is running in Microsoft Teams"
};

// Импорт основного компонента и интерфейса
import Kpfaplus from './components/Kpfaplus';
import { IKpfaplusProps } from './components/IKpfaplusProps';

export interface IKPFAPlusWebPartProps {
  description: string;
}

export default class KPFAPlusWebPart extends BaseClientSideWebPart<IKPFAPlusWebPartProps> {
  private _isDarkTheme: boolean = false;
  private _environmentMessage: string = '';
  
  protected async onInit(): Promise<void> {
    await super.onInit();
    
    // Инициализация сообщения окружения
    this._environmentMessage = this._getEnvironmentMessage();
  }

  public render(): void {
    // Создание элемента React
    const element: React.ReactElement<IKpfaplusProps> = React.createElement(
      Kpfaplus,
      {
        description: this.properties.description,
        isDarkTheme: this._isDarkTheme,
        environmentMessage: this._environmentMessage,
        hasTeamsContext: !!this.context.sdks.microsoftTeams,
        userDisplayName: this.context.pageContext.user.displayName,
        context: this.context // Передача контекста в компонент
      }
    );

    ReactDom.render(element, this.domElement);
  }

  private _getEnvironmentMessage(): string {
    if (!!this.context.sdks.microsoftTeams) { // запуск в Teams
      return this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentTeams : strings.AppTeamsTabEnvironment;
    }

    return this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentSharePoint : strings.AppSharePointEnvironment;
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || '');
      this.domElement.style.setProperty('--link', semanticColors.link || '');
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || '');
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.DescriptionFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }
}